import {
  dtoToPriceCreateInput,
  type PriceDto,
  toPriceDto,
} from "@database/dto.ts";
import prisma from "@database/prisma.ts";
import { replacePricesByBlockNumber } from "@database/repositories/price.repository.ts";
import Decimal from "decimal.js";
import { concatMap, interval, of, retry, tap } from "rxjs";

import { isStableCoin, ONE_USD } from "../../../config/constants.ts";
import { KafkaReachedEndIndexedOffset } from "../../../exceptions/consumer.exception.ts";
import { appLogger } from "../../../monitor/app.logger.ts";
import { parseDecimalToBigInt, parseToBigInt } from "../../../utils.ts";
import kafkaConnection from "../kafka.connection.ts";
import { getKafkaMessageId } from "../utils.ts";
import { AbstractKafkaStream } from "./abstract.kafka.stream.ts";

/**
 * This stream will consume from prices topic
 * 1. scan prices group by blockNumber
 * 2. fill in all empty price by bridging swaps
 */
export class FillPriceKafkaStream extends AbstractKafkaStream {
  protected fromTopic = "PRICE" as const;
  protected toTopic = "PRICE" as const;

  protected consumerName: string = "fill-price-stream";

  constructor() {
    super({
      logger: appLogger.namespace(FillPriceKafkaStream.name),
    });
  }

  protected defineProcessingPipeline(): void {
    const stream$ = this.getSubject()
      .asObservable()
      .pipe(
        tap((value) =>
          this.serviceLogger.info(`Reading offset: ${value.message.offset}`),
        ),
        concatMap((eachMessagePayload) =>
          of(eachMessagePayload).pipe(
            // decode the message
            concatMap(async (message) => {
              const rawDecodedContent =
                await this.getRawDecodedData<typeof this.fromTopic>(message);

              const { priceId: rawPriceId } = rawDecodedContent;
              return parseToBigInt(rawPriceId);
            }),
            // start querying
            concatMap(async (priceId) => {
              const priceDb = await prisma.erc20Price.findUnique({
                where: {
                  id: priceId,
                },
              });

              if (!priceDb) {
                throw new KafkaReachedEndIndexedOffset(
                  this.fromTopicName,
                  this.consumerName,
                  getKafkaMessageId(eachMessagePayload, this.consumerName),
                );
              }
              return priceDb;
            }),
            // infinite retry if data is not indexed
            retry({
              delay: (error: Error) => {
                if (error instanceof KafkaReachedEndIndexedOffset) {
                  const retryTime = 1000;
                  this.serviceLogger.info(
                    `${error.message}. Retrying in ${retryTime}ms.`,
                  );

                  return interval(retryTime);
                }

                throw error;
              },
            }),
            // bridge swap prices
            concatMap(async (priceDb) => {
              const prices = await prisma.erc20Price
                .findMany({
                  where: {
                    blockNumber: priceDb.blockNumber,
                  },
                  include: {
                    swap: true,
                  },
                })
                .then((prices) => prices.map((price) => toPriceDto(price)));
              return {
                blockNumber: priceDb.blockNumber,
                prices: bridgeSwapPrices(prices),
              };
            }),
            // TODO: fill out missing prices by most recent price of the nearest block
            concatMap(async ({ blockNumber, prices }) => {
              return {
                blockNumber: blockNumber,
                prices: prices,
              };
            }),
            // replace prices
            concatMap(async ({ blockNumber, prices }) => {
              this.serviceLogger.info(
                `Replacing prices by blockNumber: ${blockNumber}`,
              );
              await replacePricesByBlockNumber(
                blockNumber,
                prices.map((price) => dtoToPriceCreateInput(price)),
              );

              return blockNumber;
            }),
            tap((blockNumber) => {
              this.serviceLogger.info(
                `Finished processing blockNumber: ${blockNumber}. Start committing offset.`,
              );
            }),
            // send to the topic
            concatMap(async () => {
              const kafkaTransaction = await kafkaConnection.transaction();
              try {
                await kafkaTransaction.sendOffsets({
                  consumer: this.getConsumer(),
                  topics: [
                    {
                      topic: eachMessagePayload.topic,
                      partitions: [
                        {
                          partition: eachMessagePayload.partition,
                          offset: eachMessagePayload.message.offset,
                        },
                      ],
                    },
                  ],
                });

                await kafkaTransaction.commit();
              } catch (error: unknown) {
                if (error instanceof Error) {
                  this.serviceLogger.error(
                    `Error on sending to ${this.toTopicName} topic. ${error.stack}`,
                  );
                }
                await kafkaTransaction.abort();
              }
            }),
          ),
        ),
        tap(() => this.decreaseUncommitted()),
      );

    stream$.subscribe({
      error: (err) => this.serviceLogger.error(`Stream error: ${err.stack}`),
    });
  }
}

/**
 * Bridges prices within a single swap
 * @param prices Array of PriceDto belonging to the same swap
 * @returns Array of PriceDto with bridged USD prices
 */
export function bridgeSwapPrices(prices: PriceDto[]): PriceDto[] {
  if (!prices.length) return [];

  const bridgedPrices: PriceDto[] = [];
  const knownUsdPrices = new Map<string, Decimal>();

  // First pass: collect known USD prices
  prices.forEach((price) => {
    if (isStableCoin(price.tokenAddress)) {
      knownUsdPrices.set(price.tokenAddress, ONE_USD);
    } else if (price.usd_price) {
      knownUsdPrices.set(
        price.tokenAddress,
        new Decimal(price.usd_price.toString()),
      );
    }
  });

  // Second pass: bridge prices using known values
  prices.forEach((price) => {
    const updatedPrice = { ...price };

    if (!price.usd_price && knownUsdPrices.has(price.tokenAddress)) {
      const knownPrice = knownUsdPrices.get(price.tokenAddress);
      if (knownPrice) {
        updatedPrice.usd_price = parseDecimalToBigInt(knownPrice);
      }
    }

    // If this is part of a swap, try to calculate price using swap ratios
    if (updatedPrice.swap && !updatedPrice.usd_price) {
      const swap = updatedPrice.swap;
      const fromPrice = knownUsdPrices.get(swap.from);
      const toPrice = knownUsdPrices.get(swap.to);

      if (fromPrice) {
        const ratio = new Decimal(swap.toAmount.toString()).div(
          new Decimal(swap.fromAmount.toString()),
        );
        const calculatedPrice = fromPrice.div(ratio);
        updatedPrice.usd_price = parseDecimalToBigInt(calculatedPrice);
        knownUsdPrices.set(swap.to, calculatedPrice);
      } else if (toPrice) {
        const ratio = new Decimal(swap.fromAmount.toString()).div(
          new Decimal(swap.toAmount.toString()),
        );
        const calculatedPrice = toPrice.div(ratio);
        updatedPrice.usd_price = parseDecimalToBigInt(calculatedPrice);
        knownUsdPrices.set(swap.from, calculatedPrice);
      }
    }

    bridgedPrices.push(updatedPrice);
  });

  return bridgedPrices;
}
