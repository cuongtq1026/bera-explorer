import {
  dtoToPriceCreateInput,
  type PriceDto,
  type SwapDto,
  toPriceDto,
} from "@database/dto.ts";
import prisma from "@database/prisma.ts";
import { replacePricesByBlockNumber } from "@database/repositories/price.repository.ts";
import { getSwap } from "@database/repositories/swap.repository.ts";
import { PriceProcessor } from "@processors/price/price.processor.ts";
import { produce } from "immer";
import { concatMap, interval, of, retry, tap } from "rxjs";

import { KafkaReachedEndIndexedOffset } from "../../../../exceptions/consumer.exception.ts";
import { appLogger } from "../../../../monitor/app.logger.ts";
import { parseToBigInt } from "../../../../utils.ts";
import kafkaConnection from "../../kafka.connection.ts";
import type { PriceMessagePayload } from "../../producers";
import { sendKafkaMessageByTopic } from "../../producers/default.kafka.producer.ts";
import { getKafkaMessageId } from "../../utils.ts";
import { AbstractKafkaStream } from "../abstract.kafka.stream.ts";
import {
  bridgeBtcSwapPrices,
  bridgeETHSwapPrices,
  bridgeUsdSwapPrices,
  fillInBtcPrice,
  fillInEthPrice,
  fillInUsdPrice,
} from "./price.kafka.stream.utils.ts";

/**
 * This stream will consume from swaps topic
 * 1. process prices from it (store into the database)
 * 2. scan through all prices in the current block, bridging prices between them
 * 3. re-insert everything into the database
 * 4. index to prices topic
 */
export class PriceKafkaStream extends AbstractKafkaStream {
  protected fromTopic = "SWAP" as const;
  protected toTopic = "PRICE" as const;

  protected consumerName: string = "price-stream";

  constructor() {
    super({
      logger: appLogger.namespace(PriceKafkaStream.name),
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

              const { swapId: rawSwapId } = rawDecodedContent;
              return parseToBigInt(rawSwapId);
            }),
            // start querying
            concatMap(async (swapId) => {
              const swapDb = await getSwap(swapId);

              if (!swapDb) {
                throw new KafkaReachedEndIndexedOffset(
                  this.fromTopicName,
                  this.consumerName,
                  getKafkaMessageId(eachMessagePayload, this.consumerName),
                );
              }
              return swapDb;
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
            // process prices from swapId
            concatMap(async (swapDto) => {
              const { id: swapId, blockNumber } = swapDto;

              const processor = new PriceProcessor();
              const prices = await processor.process(swapId);

              return { blockNumber, insertedPrices: prices };
            }),
            // fill in missing prices by most recent price of the nearest block
            concatMap((data) => {
              return of(data).pipe(
                // bridge swap prices
                concatMap(async ({ blockNumber, insertedPrices }) => {
                  const prices = await prisma.erc20Price
                    .findMany({
                      where: {
                        blockNumber,
                      },
                      include: {
                        swap: true,
                      },
                    })
                    .then((prices) => {
                      return prices.map(
                        (price) =>
                          toPriceDto(price) as PriceDto & {
                            swap: SwapDto;
                          },
                      );
                    });

                  const updatedPrices = produce(prices, (prices) => {
                    const updatedUsdPrices = bridgeUsdSwapPrices(prices);
                    const updatedEthPrices =
                      bridgeETHSwapPrices(updatedUsdPrices);

                    return bridgeBtcSwapPrices(updatedEthPrices);
                  });
                  return {
                    blockNumber,
                    prices: updatedPrices,
                    insertedPrices,
                  };
                }),
                // start filling usd in
                concatMap(async ({ blockNumber, prices, insertedPrices }) => {
                  const filledPrices = await fillInUsdPrice({
                    blockNumber,
                    prices,
                    serviceLogger: this.serviceLogger,
                  });
                  return {
                    blockNumber: blockNumber,
                    prices: filledPrices,
                    insertedPrices,
                  };
                }),
                // start filling eth in
                concatMap(async ({ blockNumber, prices, insertedPrices }) => {
                  const filledPrices = await fillInEthPrice({
                    blockNumber,
                    prices,
                    serviceLogger: this.serviceLogger,
                  });
                  return {
                    blockNumber: blockNumber,
                    prices: filledPrices,
                    insertedPrices,
                  };
                }),
                // start filling eth in
                concatMap(async ({ blockNumber, prices, insertedPrices }) => {
                  const filledPrices = await fillInBtcPrice({
                    blockNumber,
                    prices,
                    serviceLogger: this.serviceLogger,
                  });
                  return {
                    blockNumber: blockNumber,
                    prices: filledPrices,
                    insertedPrices,
                  };
                }),
                // replace prices
                concatMap(async ({ blockNumber, prices, insertedPrices }) => {
                  this.serviceLogger.info(
                    `Replacing prices by blockNumber: ${blockNumber}`,
                  );
                  await replacePricesByBlockNumber(
                    blockNumber,
                    prices.map((price) => dtoToPriceCreateInput(price)),
                  );

                  return { prices, insertedPrices };
                }),
              );
            }),
            // log the data
            tap(({ insertedPrices }) => {
              return this.serviceLogger.info(
                `Sending to topic ${this.toTopicName}: Price length: ${insertedPrices.length}.`,
              );
            }),
            // send to the topic
            concatMap(async ({ prices, insertedPrices }) => {
              if (!prices.length && !insertedPrices.length) {
                return;
              }
              const kafkaTransaction = await kafkaConnection.transaction();
              try {
                if (insertedPrices.length) {
                  await sendKafkaMessageByTopic(
                    this.toTopic,
                    insertedPrices.map<PriceMessagePayload>((price) => ({
                      priceId: price.hash,
                    })),
                    {
                      transaction: kafkaTransaction,
                    },
                  );
                }
                if (prices.length) {
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
                }

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
      error: (err) => this.serviceLogger.error(`Stream error: ${err}`),
    });
  }
}
