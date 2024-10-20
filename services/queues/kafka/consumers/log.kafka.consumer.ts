import prisma from "@database/prisma.ts";
import { plainToInstance } from "class-transformer";
import type { EachMessagePayload } from "kafkajs";
import type { Hash } from "viem";

import {
  KafkaReachedEndIndexedOffset,
  PayloadNotFoundException,
} from "../../../exceptions/consumer.exception.ts";
import logger from "../../../monitor/logger.ts";
import { topics } from "../index.ts";
import kafkaConnection from "../kafka.connection.ts";
import { sendToLogTopic } from "../producers/log.kafka.producer.ts";
import { TransactionMessagePayload } from "../producers/transaction.kafka.producer.ts";
import { AbstractKafkaConsumer } from "./kafka.consumer.abstract.ts";

export class LogKafkaConsumer extends AbstractKafkaConsumer {
  protected topicName = topics.TRANSACTION.name;
  protected consumerName = "log";

  constructor() {
    super();
  }

  protected async handler(
    eachMessagePayload: EachMessagePayload,
  ): Promise<void> {
    const messageId = `${this.consumerName}-${eachMessagePayload.topic}-${eachMessagePayload.partition}-${eachMessagePayload.message.offset}`;

    const rawContent = eachMessagePayload.message.value;
    if (!rawContent) {
      throw new PayloadNotFoundException(messageId);
    }
    logger.info(
      `[MessageId: ${messageId}] LogKafkaConsumer message rawContent size: ${rawContent.byteLength}.`,
    );

    const rawDecodedContent = await kafkaConnection.decode(rawContent);

    logger.info(
      `[MessageId: ${messageId}] LogKafkaConsumer message rawDecodedContent: ${rawDecodedContent.toString()}`,
    );

    // transform
    const contentInstance = plainToInstance(
      TransactionMessagePayload,
      JSON.parse(rawDecodedContent.toString()),
    );

    const { hash } = contentInstance;
    // process from db if already existed
    const transactionDb = await prisma.transaction.findUnique({
      where: {
        hash,
      },
      include: {
        receipt: {
          select: {
            transactionHash: true,
            logs: {
              select: {
                logHash: true,
              },
              orderBy: [
                {
                  index: "asc",
                },
              ],
            },
          },
        },
      },
    });
    if (!transactionDb || !transactionDb.receipt) {
      // TODO: Wait until data indexed
      throw new KafkaReachedEndIndexedOffset(
        eachMessagePayload.topic,
        this.consumerName,
        hash,
      );
    }

    await this.onFinish(eachMessagePayload, {
      transactionHash: hash,
      logs: transactionDb.receipt.logs.map((t) => t.logHash as Hash),
    });
  }

  protected async onFinish(
    eachMessagePayload: EachMessagePayload,
    data: { transactionHash: string; logs: string[] },
  ): Promise<void> {
    const { logs } = data;

    if (!logs.length) {
      return super.onFinish(eachMessagePayload, data);
    }

    const messageId = `${this.consumerName}-${eachMessagePayload.topic}-${eachMessagePayload.partition}-${eachMessagePayload.message.offset}`;

    // Send to log topic
    await sendToLogTopic(
      logs.map((log) => ({
        logHash: log,
      })),
    );
    logger.info(
      `[MessageId: ${messageId}] Sent ${logs.length} messages to log topic.`,
    );
    return super.onFinish(eachMessagePayload, data);
  }
}
