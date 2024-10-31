import {
  dtoToPriceCreateInput,
  type PriceDto,
  type SwapDto,
  toPriceDto,
} from "@database/dto.ts";
import prisma from "@database/prisma.ts";
import { replacePricesByBlockNumber } from "@database/repositories/price.repository.ts";
import { getSwap } from "@database/repositories/swap.repository.ts";
import { PriceProcessor } from "@processors/price.processor.ts";
import Decimal from "decimal.js";
import { concatMap, interval, of, retry, tap } from "rxjs";

import {
  isStableCoin,
  ONE_ETH_VALUE,
  ONE_USD_VALUE,
} from "../../../config/constants.ts";
import { KafkaReachedEndIndexedOffset } from "../../../exceptions/consumer.exception.ts";
import { AppLogger, appLogger } from "../../../monitor/app.logger.ts";
import { parseDecimalToBigInt, parseToBigInt } from "../../../utils.ts";
import kafkaConnection from "../kafka.connection.ts";
import { PriceMessagePayload } from "../producers";
import { sendKafkaMessageByTopic } from "../producers/default.kafka.producer.ts";
import { getKafkaMessageId } from "../utils.ts";
import { AbstractKafkaStream } from "./abstract.kafka.stream.ts";

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

                  const updatedUsdPrices = bridgeUsdSwapPrices(prices);
                  const updatedEthPrices =
                    bridgeETHSwapPrices(updatedUsdPrices);
                  return {
                    blockNumber,
                    prices: updatedEthPrices,
                    insertedPrices,
                  };
                }),
                // start filling usd in
                concatMap(async ({ blockNumber, prices, insertedPrices }) => {
                  await fillInUsdPrice({
                    blockNumber,
                    prices,
                    serviceLogger: this.serviceLogger,
                  });
                  return {
                    blockNumber: blockNumber,
                    prices: prices,
                    insertedPrices,
                  };
                }),
                // start filling eth in
                concatMap(async ({ blockNumber, prices, insertedPrices }) => {
                  await fillInEthPrice({
                    blockNumber,
                    prices,
                    serviceLogger: this.serviceLogger,
                  });
                  return {
                    blockNumber: blockNumber,
                    prices: prices,
                    insertedPrices,
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

                  return prices;
                }),
              );
            }),
            // log the data
            tap((prices) => {
              return this.serviceLogger.info(
                `Sending to topic ${this.toTopicName}: Price length: ${prices.length}.`,
              );
            }),
            // send to the topic
            concatMap(async (prices) => {
              if (!prices.length) {
                return;
              }
              const kafkaTransaction = await kafkaConnection.transaction();
              try {
                // TODO: Fix duplicate messages
                await sendKafkaMessageByTopic(
                  this.toTopic,
                  prices.map<PriceMessagePayload>((price) => ({
                    priceId: price.hash,
                  })),
                  {
                    transaction: kafkaTransaction,
                  },
                );
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
      error: (err) => this.serviceLogger.error(`Stream error: ${err}`),
    });
  }
}

/**
 * Bridges usd prices within a single swap
 * @param prices Array of PriceDto belonging to the same swap
 * @returns Array of PriceDto with bridged USD prices
 */
export function bridgeUsdSwapPrices(
  prices: (PriceDto & {
    swap: SwapDto;
  })[],
): (PriceDto & {
  swap: SwapDto;
})[] {
  if (!prices.length) return [];

  const bridgedPrices: (PriceDto & {
    swap: SwapDto;
  })[] = [];
  const knownUsdPrices = new Map<string, Decimal>();

  // First pass: collect known USD prices
  prices.forEach((price) => {
    if (isStableCoin(price.tokenAddress)) {
      knownUsdPrices.set(price.tokenAddress, ONE_USD_VALUE);
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

/**
 * Bridges eth prices within a single swap
 * @param prices Array of PriceDto belonging to the same swap
 * @returns Array of PriceDto with bridged ETH prices
 */
export function bridgeETHSwapPrices(
  prices: (PriceDto & {
    swap: SwapDto;
  })[],
): (PriceDto & {
  swap: SwapDto;
})[] {
  if (!prices.length) return [];

  const bridgedPrices: (PriceDto & {
    swap: SwapDto;
  })[] = [];
  const knownEthPrices = new Map<string, Decimal>();

  // First pass: collect known USD prices
  prices.forEach((price) => {
    if (isStableCoin(price.tokenAddress)) {
      knownEthPrices.set(price.tokenAddress, ONE_ETH_VALUE);
    } else if (price.ethPrice) {
      knownEthPrices.set(
        price.tokenAddress,
        new Decimal(price.ethPrice.toString()),
      );
    }
  });

  // Second pass: bridge prices using known values
  prices.forEach((price) => {
    const updatedPrice = { ...price };

    if (!price.ethPrice && knownEthPrices.has(price.tokenAddress)) {
      const knownPrice = knownEthPrices.get(price.tokenAddress);
      if (knownPrice) {
        updatedPrice.ethPrice = parseDecimalToBigInt(knownPrice);
      }
    }

    // If this is part of a swap, try to calculate price using swap ratios
    if (updatedPrice.swap && !updatedPrice.ethPrice) {
      const swap = updatedPrice.swap;
      const fromPrice = knownEthPrices.get(swap.from);
      const toPrice = knownEthPrices.get(swap.to);

      if (fromPrice) {
        const ratio = new Decimal(swap.toAmount.toString()).div(
          new Decimal(swap.fromAmount.toString()),
        );
        const calculatedPrice = fromPrice.div(ratio);
        updatedPrice.ethPrice = parseDecimalToBigInt(calculatedPrice);
        knownEthPrices.set(swap.to, calculatedPrice);
      } else if (toPrice) {
        const ratio = new Decimal(swap.fromAmount.toString()).div(
          new Decimal(swap.toAmount.toString()),
        );
        const calculatedPrice = toPrice.div(ratio);
        updatedPrice.ethPrice = parseDecimalToBigInt(calculatedPrice);
        knownEthPrices.set(swap.from, calculatedPrice);
      }
    }

    bridgedPrices.push(updatedPrice);
  });

  return bridgedPrices;
}

async function fillInUsdPrice(args: {
  blockNumber: number | bigint;
  serviceLogger: AppLogger;
  prices: (PriceDto & {
    swap: SwapDto;
  })[];
}) {
  const { prices, serviceLogger, blockNumber } = args;
  for (const price of prices) {
    if (price.usd_price !== 0n) {
      continue;
    }
    serviceLogger.info(
      `[Price: ${price.hash}] usd_price is 0. Filling in by the other side of the swap.`,
    );
    // try to get price from other side of the swap
    const isFrom = price.swap.from === price.tokenAddress;
    const swapToken = isFrom ? price.swap.to : price.swap.from;
    const swapTokenPrice = await prisma.erc20Price.findFirst({
      where: {
        tokenAddress: swapToken,
        blockNumber,
      },
      orderBy: [
        {
          blockNumber: "desc",
        },
        { transactionIndex: "desc" },
      ],
    });
    // if the other side of the swap token has price, use it
    if (swapTokenPrice != null && !swapTokenPrice.usd_price.eq(0)) {
      // calculate price
      const fromAmount = new Decimal(price.swap.fromAmount.toString());
      const toAmount = new Decimal(price.swap.toAmount.toString());
      const ratio = isFrom
        ? toAmount.div(fromAmount)
        : fromAmount.div(toAmount);
      const calculatedPrice = swapTokenPrice.usd_price.mul(ratio);

      price.usd_price = parseDecimalToBigInt(calculatedPrice);
      price.price_ref_hash = swapTokenPrice.hash;

      continue;
    }

    serviceLogger.info(
      `[Price: ${price.hash}] The other side of the swap doesn't have price. Use the previous price.`,
    );
    // if not, use the previous price
    const previousPrice = await prisma.erc20Price.findFirst({
      where: {
        tokenAddress: price.tokenAddress,
        blockNumber: {
          lt: blockNumber,
        },
      },
      orderBy: [
        {
          blockNumber: "desc",
        },
        { transactionIndex: "desc" },
      ],
    });
    // if the previous price has price, use it
    if (previousPrice != null && !previousPrice.usd_price.eq(0)) {
      price.usd_price = parseDecimalToBigInt(previousPrice.usd_price);
      price.price_ref_hash = previousPrice.hash;

      continue;
    }

    // if not, use the previous swap price
    serviceLogger.info(
      `[Price: ${price.hash}] There's not previous price. Use the previous price of the other side of the swap.`,
    );
    const previousPriceSwapToken = await prisma.erc20Price.findFirst({
      where: {
        tokenAddress: swapToken,
        blockNumber: {
          lt: blockNumber,
        },
      },
      orderBy: [
        {
          blockNumber: "desc",
        },
        { transactionIndex: "desc" },
      ],
    });
    if (previousPriceSwapToken == null) {
      // there's no price for both of them, might both of them be new tokens
      continue;
    }
    if (previousPriceSwapToken.usd_price.eq(0)) {
      throw Error(
        `[PriceID: ${price.hash}] Found both previous price with 0 usd_price.`,
      );
    }
    // calculate price
    const fromAmount = new Decimal(price.swap.fromAmount.toString());
    const toAmount = new Decimal(price.swap.toAmount.toString());
    const ratio = isFrom ? toAmount.div(fromAmount) : fromAmount.div(toAmount);
    const calculatedPrice = previousPriceSwapToken.usd_price.mul(ratio);

    price.usd_price = parseDecimalToBigInt(calculatedPrice);
    price.price_ref_hash = previousPriceSwapToken.hash;
  }
}

async function fillInEthPrice(args: {
  blockNumber: number | bigint;
  serviceLogger: AppLogger;
  prices: (PriceDto & {
    swap: SwapDto;
  })[];
}) {
  const { prices, serviceLogger, blockNumber } = args;
  for (const price of prices) {
    if (price.ethPrice !== 0n) {
      continue;
    }
    serviceLogger.info(
      `[Price: ${price.hash}] ethPrice is 0. Filling in by the other side of the swap.`,
    );
    // try to get price from other side of the swap
    const isFrom = price.swap.from === price.tokenAddress;
    const swapToken = isFrom ? price.swap.to : price.swap.from;
    const swapTokenPrice = await prisma.erc20Price.findFirst({
      where: {
        tokenAddress: swapToken,
        blockNumber,
      },
      orderBy: [
        {
          blockNumber: "desc",
        },
        { transactionIndex: "desc" },
      ],
    });
    // if the other side of the swap token has price, use it
    if (swapTokenPrice != null && !swapTokenPrice.ethPrice.eq(0)) {
      // calculate price
      const fromAmount = new Decimal(price.swap.fromAmount.toString());
      const toAmount = new Decimal(price.swap.toAmount.toString());
      const ratio = isFrom
        ? toAmount.div(fromAmount)
        : fromAmount.div(toAmount);
      const calculatedPrice = swapTokenPrice.ethPrice.mul(ratio);

      price.ethPrice = parseDecimalToBigInt(calculatedPrice);
      price.ethPriceRefHash = swapTokenPrice.hash;

      continue;
    }

    serviceLogger.info(
      `[Price: ${price.hash}] The other side of the swap doesn't have ethPrice. Use the previous ethPrice.`,
    );
    // if not, use the previous price
    const previousPrice = await prisma.erc20Price.findFirst({
      where: {
        tokenAddress: price.tokenAddress,
        blockNumber: {
          lt: blockNumber,
        },
      },
      orderBy: [
        {
          blockNumber: "desc",
        },
        { transactionIndex: "desc" },
      ],
    });
    // if the previous price has price, use it
    if (previousPrice != null && !previousPrice.ethPrice.eq(0)) {
      price.ethPrice = parseDecimalToBigInt(previousPrice.ethPrice);
      price.ethPriceRefHash = previousPrice.hash;

      continue;
    }

    // if not, use the previous swap eth price
    serviceLogger.info(
      `[Price: ${price.hash}] There's not previous eth price. Use the previous eth price of the other side of the swap.`,
    );
    const previousPriceSwapToken = await prisma.erc20Price.findFirst({
      where: {
        tokenAddress: swapToken,
        blockNumber: {
          lt: blockNumber,
        },
      },
      orderBy: [
        {
          blockNumber: "desc",
        },
        { transactionIndex: "desc" },
      ],
    });
    if (previousPriceSwapToken == null) {
      // there's no price for both of them, might both of them be new tokens
      continue;
    }
    if (previousPriceSwapToken.ethPrice.eq(0)) {
      throw Error(
        `[PriceID: ${price.hash}] Found both previous price with 0 ethPrice.`,
      );
    }
    // calculate price
    const fromAmount = new Decimal(price.swap.fromAmount.toString());
    const toAmount = new Decimal(price.swap.toAmount.toString());
    const ratio = isFrom ? toAmount.div(fromAmount) : fromAmount.div(toAmount);
    const calculatedPrice = previousPriceSwapToken.ethPrice.mul(ratio);

    price.ethPrice = parseDecimalToBigInt(calculatedPrice);
    price.ethPriceRefHash = previousPriceSwapToken.hash;
  }
}
