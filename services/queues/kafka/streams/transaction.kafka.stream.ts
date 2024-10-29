import prisma from "@database/prisma.ts";
import { concatMap, interval, of, retry, tap } from "rxjs";
import type { Hash } from "viem";

import { KafkaReachedEndIndexedOffset } from "../../../exceptions/consumer.exception.ts";
import { appLogger } from "../../../monitor/app.logger.ts";
import { parseToBigInt } from "../../../utils.ts";
import kafkaConnection from "../kafka.connection.ts";
import { sendKafkaMessageByTopic } from "../producers";
import { getKafkaMessageId } from "../utils.ts";
import { AbstractKafkaStream } from "./abstract.kafka.stream.ts";

export class TransactionKafkaStream extends AbstractKafkaStream {
  protected fromTopic = "BLOCK" as const;
  protected toTopic = "INDEXED_TRANSACTION" as const;
  protected consumerName: string = "transaction-stream";

  constructor() {
    super({
      logger: appLogger.namespace(TransactionKafkaStream.name),
    });
  }

  protected defineProcessingPipeline() {
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

              const { blockNumber: rawBlockNumber } = rawDecodedContent;
              return parseToBigInt(rawBlockNumber);
            }),
            // start querying
            concatMap(async (blockNumber) => {
              const dbBlock = await prisma.block.findUnique({
                where: {
                  number: blockNumber,
                },
                include: {
                  transactions: {
                    select: {
                      hash: true,
                    },
                    orderBy: [
                      {
                        transactionIndex: "asc",
                      },
                    ],
                  },
                },
              });

              if (!dbBlock) {
                throw new KafkaReachedEndIndexedOffset(
                  this.fromTopicName,
                  this.consumerName,
                  getKafkaMessageId(eachMessagePayload, this.consumerName),
                );
              }

              return dbBlock;
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
            // log the database data
            tap((block) =>
              this.serviceLogger.info(
                `Sending to topic ${this.toTopicName}: blockNumber ${block.number}`,
              ),
            ),
            // send to the topic
            concatMap(async (block) => {
              const { transactions } = block;
              if (!transactions.length) {
                return;
              }
              const kafkaTransaction = await kafkaConnection.transaction();
              try {
                await sendKafkaMessageByTopic(
                  this.toTopic,
                  transactions.map((transaction) => ({
                    hash: transaction.hash as Hash,
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
