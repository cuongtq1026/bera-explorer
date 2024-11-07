import { toSwapDto, toTransactionDto } from "@database/dto.ts";
import prisma from "@database/prisma.ts";
import { getCopyContracts } from "@database/repositories/copy-contract.repository.ts";
import { getSwap } from "@database/repositories/swap.repository.ts";
import { concatMap, filter, finalize, interval, of, retry, tap } from "rxjs";
import { type Account, type Hash, isHash } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { getCopyTradingDex } from "../../../copy-trading/copy-trading-dex.factory.ts";
import { KafkaReachedEndIndexedOffset } from "../../../exceptions/consumer.exception.ts";
import { appLogger } from "../../../monitor/app.logger.ts";
import kafkaConnection from "../kafka.connection.ts";
import { CopyTradeMessagePayload } from "../producers";
import { sendKafkaMessageByTopic } from "../producers/default.kafka.producer.ts";
import { getKafkaMessageId } from "../utils.ts";
import { AbstractKafkaStream } from "./abstract.kafka.stream.ts";

/**
 * A Kafka stream that copy trade swaps and log it into copy_trade_logs topic
 */
export class CopyTradingKafkaStream extends AbstractKafkaStream {
  protected fromTopic = "SWAP" as const;
  protected toTopic = "COPY_TRADE_LOG" as const;
  protected consumerName: string = "copy-stream";
  private readonly account: Account;

  constructor() {
    super({
      logger: appLogger.namespace(CopyTradingKafkaStream.name),
    });

    {
      const copyTradingWalletPrivateKey =
        process.env.COPY_TRADING_WALLET_PRIVATE_KEY;
      if (!copyTradingWalletPrivateKey) {
        throw new Error("No copy trading wallet private key");
      }
      if (!isHash(copyTradingWalletPrivateKey)) {
        throw new Error("No copy trading wallet private key");
      }

      this.account = privateKeyToAccount(copyTradingWalletPrivateKey);
    }
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

              const { swapHash } = rawDecodedContent;
              return swapHash;
            }),
            // start querying
            concatMap(async (swapHash) => {
              const swapDb = await prisma.swap.findUnique({
                where: {
                  hash: swapHash,
                },
                include: {
                  transaction: true,
                },
              });

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
            // Filter out non root swap
            filter((swapDb) => swapDb.isRoot),
            concatMap(async (swap) => {
              const target = swap.from as Hash;
              const copyContracts = await getCopyContracts(target);
              return {
                swap,
                copyContracts,
              };
            }),
            // Filter out swap which doesn't have any target
            filter((result) => result.copyContracts.length > 0),
            // log out
            tap((result) => {
              this.serviceLogger.info(
                `SwapHash: ${result.swap.hash} has ${result.copyContracts} follower(s).`,
              );
            }),
            // start copy trading
            concatMap(async ({ swap, copyContracts }) => {
              const copyTradingDEX = getCopyTradingDex(swap.dex);

              const copyResults: CopyTradeMessagePayload[] = await Promise.all(
                copyContracts.map(async (copyContract) => {
                  return copyTradingDEX.execute({
                    copyContractAddress: copyContract.contractAddress,
                    swap: toSwapDto(swap),
                    transaction: toTransactionDto(swap.transaction),
                    account: this.account,
                  });
                }),
              );

              return {
                swap,
                copyResults,
              };
            }),
            // log the copy trading data
            tap((result) => {
              const total = result.copyResults.length;
              const totalProcessed = result.copyResults.filter(
                (result) => result.isSuccess,
              ).length;
              this.serviceLogger.info(
                `Sending to topic ${this.toTopicName}. SwapHash: ${result.swap.hash} | Total: ${total} | Success: ${totalProcessed} | Failed: ${total - totalProcessed}`,
              );
            }),
            // send to the topic
            concatMap(async (result) => {
              const kafkaTransaction = await kafkaConnection.transaction();
              try {
                await sendKafkaMessageByTopic(
                  this.toTopic,
                  result.copyResults,
                  {
                    transaction: kafkaTransaction,
                  },
                );
                const group = await this.getConsumer().describeGroup();
                await kafkaTransaction.sendOffsets({
                  consumerGroupId: group.groupId,
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
        finalize(() => this.decreaseUncommitted()),
      );

    stream$.subscribe({
      error: (err) => this.serviceLogger.error(`Stream error: ${err}`),
    });
  }
}
