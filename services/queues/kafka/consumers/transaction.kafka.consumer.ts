import type { KafkaJS } from "@confluentinc/kafka-javascript";
import prisma from "@database/prisma.ts";
import { plainToInstance } from "class-transformer";
import type { Hash } from "viem";

import { KafkaReachedEndIndexedOffset } from "../../../exceptions/consumer.exception.ts";
import { appLogger } from "../../../monitor/app.logger.ts";
import { parseToBigInt } from "../../../utils.ts";
import { BlockMessagePayload } from "../producers";
import { sendToTransactionTopic } from "../producers/transaction.kafka.producer.ts";
import { AbstractKafkaConsumer } from "./kafka.consumer.abstract.ts";

const serviceLogger = appLogger.namespace("TransactionKafkaConsumer");

export class TransactionKafkaConsumer extends AbstractKafkaConsumer {
  protected topic = "BLOCK" as const;
  protected consumerName = "transaction";

  constructor() {
    super({
      logger: appLogger.namespace(TransactionKafkaConsumer.name),
    });
  }

  protected async handler(
    eachMessagePayload: KafkaJS.EachMessagePayload,
  ): Promise<void> {
    const rawDecodedContent =
      await this.getRawDecodedData<typeof this.topic>(eachMessagePayload);

    // transform
    const contentInstance = plainToInstance(
      BlockMessagePayload,
      JSON.parse(rawDecodedContent.toString()),
    );

    const { blockNumber: rawBlockNumber } = contentInstance;
    const blockNumber = parseToBigInt(rawBlockNumber);
    // process from db if already existed
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
    if (dbBlock) {
      await this.onFinish(eachMessagePayload, {
        blockNumber,
        transactions: dbBlock.transactions.map((t) => t.hash as Hash),
      });
      return;
    }

    throw new KafkaReachedEndIndexedOffset(
      eachMessagePayload.topic,
      this.consumerName,
      blockNumber.toString(),
    );
  }

  protected async onFinish(
    eachMessagePayload: KafkaJS.EachMessagePayload,
    data: { blockNumber: number | bigint; transactions: Hash[] },
  ): Promise<void> {
    const messageId = `${this.consumerName}-${eachMessagePayload.topic}-${eachMessagePayload.partition}-${eachMessagePayload.message.offset}`;

    // Send to transaction topic
    const { transactions } = data;
    await sendToTransactionTopic(
      transactions.map((transaction) => ({
        hash: transaction,
      })),
    );
    serviceLogger.info(
      `[MessageId: ${messageId}] Sent ${transactions.length} messages to transaction topic.`,
    );

    return super.onFinish(eachMessagePayload, data);
  }
}
