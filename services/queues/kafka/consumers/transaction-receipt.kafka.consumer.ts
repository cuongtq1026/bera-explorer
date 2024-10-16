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
import { sendToTransferTopic } from "../producers";
import { AbstractKafkaConsumer } from "./kafka.consumer.abstract.ts";

export class TransactionReceiptKafkaConsumer extends AbstractKafkaConsumer {
  protected topicName = topics.TRANSACTION.name;

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
          },
        },
        transfers: {
          select: {
            hash: true,
            logIndex: true,
          },
          orderBy: [
            {
              logIndex: "asc",
            },
          ],
        },
      },
    });
    if (transactionDb && transactionDb.receipt) {
      await this.onFinish(eachMessagePayload, {
        transactionHash: hash,
        transfers: transactionDb.transfers.map((t) => t.hash as Hash),
      });
      return;
    }

    // Throw to temporary stop the consuming job
    // and keep retrying until transaction receipt got indexed into the db
    throw new KafkaReachedEndIndexedOffset(eachMessagePayload.topic, hash);
  }

  protected async onFinish(
    eachMessagePayload: EachMessagePayload,
    data: { transactionHash: string; transfers: string[] },
  ): Promise<void> {
    const messageId = `${eachMessagePayload.topic}-${eachMessagePayload.partition}-${eachMessagePayload.message.offset}`;

    // Send to transaction topic
    const { transfers } = data;
    await sendToTransferTopic(transfers);
    logger.info(
      `[MessageId: ${messageId}] Sent ${transfers.length} messages to transfer topic.`,
    );

    return super.onFinish(eachMessagePayload, data);
  }
}
