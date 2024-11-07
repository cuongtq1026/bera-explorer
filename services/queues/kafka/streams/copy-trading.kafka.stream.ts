import { toSwapDto } from "@database/dto.ts";
import prisma from "@database/prisma.ts";
import { getCopyContracts } from "@database/repositories/copy-contract.repository.ts";
import { getSwap } from "@database/repositories/swap.repository.ts";
import { concatMap, filter, interval, of, retry, tap } from "rxjs";
import { type Account, getContract, type Hash, isHash } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { BeraCopyAbi } from "../../../config/abis";
import { ETH_ADDRESS } from "../../../config/constants.ts";
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
export class CopyTradingKafkaStream extends AbstractKafkaStream {
  protected fromTopic = "SWAP" as const;
  protected toTopic = "COPY_TRADE_LOG" as const;
  protected consumerName: string = "copy-stream";
  private readonly dexAddress: Hash;
  private readonly account: Account;

  constructor() {
    super({
      logger: appLogger.namespace(CopyTradingKafkaStream.name),
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

              const { swapHash } = rawDecodedContent;
              return swapHash;
            }),
            // start querying
            concatMap(async (swapHash) => {
              const swapDto = await getSwap(swapHash);

              if (!swapDto) {
                throw new KafkaReachedEndIndexedOffset(
                  this.fromTopicName,
                  this.consumerName,
                  getKafkaMessageId(eachMessagePayload, this.consumerName),
                );
              }

              return swapDto;
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
            // TODO: Filter out swap doesn't get target and finish if no swaps found
            concatMap(async (swap) => {
              const target = swap.from as Hash;
              const copyContracts = await getCopyContracts(target);
              return {
                swap,
                copyContracts,
              };
            }),
            // log out
            tap((result) => {
              this.serviceLogger.info(
                `SwapHash: ${result.swap.hash} has ${result.copyContracts} follower(s).`,
              );
            }),
            // start copy trading
            // TODO: Fix this, not finished yet
            concatMap(async ({ swap, copyContracts }) => {
              const copyResults: CopyTradeMessagePayload[] = await Promise.all(
                copyContracts.map(async (copyContract) => {
                  const client = await rpcRequest.getWalletClient();
                  if (!client.chain) {
                    throw new Error("No wallet client chain");
                  }

                  const copyContractAddress = copyContract.contractAddress;
                  const contract = getContract({
                    address: copyContractAddress,
                    abi: BeraCopyAbi,
                    client,
                  });

                  // TODO: Make factory for each DEX
                  // TODO: Store swap root
                  try {
                    const txHash = await contract.write.multiSwap(
                      [
                        this.dexAddress,
                        [
                          {
                            poolIdx: 36000n,
                            base: swap.from,
                            quote: swap.to,
                            isBuy: true,
                          },
                        ],
                        swap.fromAmount, // Exact copy for now
                        0n, // 0 for now, will be added to the contract slippage
                      ],
                      {
                        chain: client.chain,
                        account: this.account,
                        value: swap.from === ETH_ADDRESS ? swap.fromAmount : 0n,
                      },
                    );
                    this.serviceLogger.info(
                      `Copy trade sent. SwapHash: ${swap.hash} | TxHash: ${txHash}`,
                    );
                    return {
                      swapHash: swap.hash,
                      isSuccess: true,
                      transactionHash: txHash,
                      error: null,
                    } as CopyTradeMessagePayload<true>;
                  } catch (e: unknown) {
                    this.serviceLogger.error(
                      `Error on processing copy trading on SwapHash: ${swap.hash}`,
                    );

                    if (e instanceof Error && e.stack) {
                      return {
                        swapHash: swap.hash,
                        isSuccess: false,
                        transactionHash: null,
                        error: e.stack,
                      } as CopyTradeMessagePayload<false>;
                    }
                    throw e;
                  }
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
        tap(() => this.decreaseUncommitted()),
      );

    stream$.subscribe({
      error: (err) => this.serviceLogger.error(`Stream error: ${err}`),
    });
  }
}
