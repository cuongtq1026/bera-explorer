import { toSwapDto } from "@database/dto.ts";
import prisma from "@database/prisma.ts";
import { concatMap, interval, of, retry, tap } from "rxjs";
import { type Account, getContract, type Hash, isHash } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { BeraCopyAbi } from "../../../config/abis";
import rpcRequest from "../../../data-source/rpc-request";
import { KafkaReachedEndIndexedOffset } from "../../../exceptions/consumer.exception.ts";
import { appLogger } from "../../../monitor/app.logger.ts";
import { parseToBigInt } from "../../../utils.ts";
import kafkaConnection from "../kafka.connection.ts";
import { CopyTradeMessagePayload } from "../producers";
import { sendKafkaMessageByTopic } from "../producers/default.kafka.producer.ts";
import { getKafkaMessageId } from "../utils.ts";
import { AbstractKafkaStream } from "./abstract.kafka.stream.ts";

/**
 * A Kafka stream that copy trade swaps and log it into copy_trade_logs topic
 */
export class CopyTradeKafkaStream extends AbstractKafkaStream {
  protected fromTopic = "SWAP" as const;
  protected toTopic = "COPY_TRADE_LOG" as const;
  protected consumerName: string = "copy-stream";
  private readonly dexAddress: Hash;
  private readonly account: Account;

  constructor() {
    super({
      logger: appLogger.namespace(CopyTradeKafkaStream.name),
    });

    {
      const dexAddress = process.env.DEX_ADDRESS;
      if (!dexAddress) {
        throw new Error("DEX_ADDRESS is not set");
      }
      if (!isHash(dexAddress)) {
        throw new Error("DEX_ADDRESS is not a valid hash");
      }
      this.dexAddress = dexAddress;
    }

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

              const { swapId } = rawDecodedContent;
              return parseToBigInt(swapId);
            }),
            // start querying
            concatMap(async (swapId) => {
              const dbSwap = await prisma.swap.findUnique({
                where: {
                  id: swapId,
                },
              });

              if (!dbSwap) {
                throw new KafkaReachedEndIndexedOffset(
                  this.fromTopicName,
                  this.consumerName,
                  getKafkaMessageId(eachMessagePayload, this.consumerName),
                );
              }

              return toSwapDto(dbSwap);
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
            // start copy trading
            concatMap(async (swap): Promise<CopyTradeMessagePayload> => {
              const client = await rpcRequest.getWalletClient();
              if (!client.chain) {
                throw new Error("No wallet client chain");
              }

              const copyContract = "0x123";
              const contract = getContract({
                address: copyContract,
                abi: BeraCopyAbi,
                client,
              });

              const value = 900000000000n;
              try {
                const txHash = await contract.write.multiSwap(
                  [
                    this.dexAddress,
                    [
                      {
                        poolIdx: 36000n,
                        base: "0x0E4aaF1351de4c0264C5c7056Ef3777b41BD8e03",
                        quote: "0x0000000000000000000000000000000000000000",
                        isBuy: false,
                      },
                    ],
                    value,
                    0n,
                  ],
                  {
                    chain: client.chain,
                    account: this.account,
                    value,
                  },
                );
                this.serviceLogger.info(
                  `Copy trade sent. SwapID: ${swap.id} | TxHash: ${txHash}`,
                );
                return {
                  swapId: swap.id.toString(),
                  isSuccess: true,
                  transactionHash: txHash,
                  error: null,
                } as CopyTradeMessagePayload<true>;
              } catch (e: unknown) {
                this.serviceLogger.error(
                  `Error on processing copy trading on swapId: ${swap.id}`,
                );

                if (e instanceof Error && e.stack) {
                  return {
                    swapId: swap.id.toString(),
                    isSuccess: false,
                    transactionHash: null,
                    error: e.stack,
                  } as CopyTradeMessagePayload<false>;
                }
                throw e;
              }
            }),
            // log the copy trading data
            tap((result) => {
              this.serviceLogger.info(
                `Sending to topic ${this.toTopicName}. SwapID: ${result.swapId} | Success: ${result.isSuccess}`,
              );
            }),
            // send to the topic
            concatMap(async (result) => {
              const kafkaTransaction = await kafkaConnection.transaction();
              try {
                await sendKafkaMessageByTopic(this.toTopic, [result], {
                  transaction: kafkaTransaction,
                });
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
        tap(() => this.decreaseUncommitted()),
      );

    stream$.subscribe({
      error: (err) => this.serviceLogger.error(`Stream error: ${err}`),
    });
  }
}
