import { getSwap } from "@database/repositories/swap.repository.ts";
import { PriceProcessor } from "@processors/price.processor.ts";
import { concatMap, interval, of, retry, tap } from "rxjs";

import { KafkaReachedEndIndexedOffset } from "../../../exceptions/consumer.exception.ts";
import { appLogger } from "../../../monitor/app.logger.ts";
import { parseToBigInt } from "../../../utils.ts";
import kafkaConnection from "../kafka.connection.ts";
import { PriceMessagePayload } from "../producers";
import { sendKafkaMessageByTopic } from "../producers/default.kafka.producer.ts";
import { getKafkaMessageId } from "../utils.ts";
import { AbstractKafkaStream } from "./abstract.kafka.stream.ts";

/**
 * This stream will consume from swaps topic
 * 1. process prices from it (store into db)
 * 2. index to prices topic
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
              const { id: swapId } = swapDto;

              const processor = new PriceProcessor();
              const prices = await processor.process(swapId);

              return prices;
            }),
            // log the data
            tap((prices) =>
              this.serviceLogger.info(
                `Sending to topic ${this.toTopicName}: Price length: ${prices.length}.`,
              ),
            ),
            // send to the topic
            concatMap(async (prices) => {
              if (!prices.length) {
                return;
              }
              const kafkaTransaction = await kafkaConnection.transaction();
              try {
                await sendKafkaMessageByTopic(
                  this.toTopic,
                  prices.map<PriceMessagePayload>((price) => ({
                    priceId: price.id.toString(),
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
