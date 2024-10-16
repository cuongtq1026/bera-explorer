import prisma from "@database/prisma.ts";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import type { EachMessagePayload } from "kafkajs";
import type { Hash } from "viem";

import {
  InvalidPayloadException,
  KafkaReachedEndIndexedOffset,
  PayloadNotFoundException,
} from "../../../exceptions/consumer.exception.ts";
import logger from "../../../monitor/logger.ts";
import { topics, TransactionMessagePayload } from "../index.ts";
import { sendToLogTopic } from "../producers";
import { AbstractKafkaConsumer } from "./kafka.consumer.abstract.ts";

export class LogKafkaConsumer extends AbstractKafkaConsumer {
  protected topicName = topics.TRANSACTION.name;
  protected consumerName = "receipt";

  constructor() {
    super();
  }

  protected async handler(
    eachMessagePayload: EachMessagePayload,
  ): Promise<void> {
    const messageId = `${eachMessagePayload.topic}-${eachMessagePayload.partition}-${eachMessagePayload.message.offset}`;

    const rawContent = eachMessagePayload.message.value?.toString();
    logger.info(
      `[MessageId: ${messageId}] TransactionReceiptKafkaConsumer message rawContent: ${rawContent}.`,
    );

    if (!rawContent) {
      throw new PayloadNotFoundException(messageId);
    }

    // transform
    const contentInstance = plainToInstance(
      TransactionMessagePayload,
      JSON.parse(rawContent),
    );

    // validation
    const errors = await validate(contentInstance);
    if (errors.length > 0) {
      throw new InvalidPayloadException(messageId);
    }

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
    if (transactionDb && transactionDb.receipt) {
      await this.onFinish(eachMessagePayload, {
        transactionHash: hash,
        logs: transactionDb.receipt.logs.map((t) => t.logHash as Hash),
      });
      return;
    }

    // TODO: Wait until data indexed
    throw new KafkaReachedEndIndexedOffset(eachMessagePayload.topic, hash);
  }

  protected async onFinish(
    eachMessagePayload: EachMessagePayload,
    data: { transactionHash: string; logs: string[] },
  ): Promise<void> {
    const { logs } = data;

    if (!logs.length) {
      return super.onFinish(eachMessagePayload, data);
    }

    const messageId = `${eachMessagePayload.topic}-${eachMessagePayload.partition}-${eachMessagePayload.message.offset}`;

    // Send to log topic
    await sendToLogTopic(logs);
    logger.info(
      `[MessageId: ${messageId}] Sent ${logs.length} messages to log topic.`,
    );
    return super.onFinish(eachMessagePayload, data);
  }
}
