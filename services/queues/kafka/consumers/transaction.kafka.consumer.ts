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
import { BlockMessagePayload, topics } from "../index.ts";
import { sendToTransactionTopic } from "../producers";
import { AbstractKafkaConsumer } from "./kafka.consumer.abstract.ts";

export class TransactionKafkaConsumer extends AbstractKafkaConsumer {
  protected topicName = topics.BLOCK.name;
  protected consumerName = "block";

  constructor() {
    super();
  }

  protected async handler(
    eachMessagePayload: EachMessagePayload,
  ): Promise<void> {
    const messageId = `${this.consumerName}-${eachMessagePayload.topic}-${eachMessagePayload.partition}-${eachMessagePayload.message.offset}`;

    const rawContent = eachMessagePayload.message.value?.toString();
    logger.info(
      `[MessageId: ${messageId}] BlockKafkaConsumer message rawContent: ${rawContent}.`,
    );

    if (!rawContent) {
      throw new PayloadNotFoundException(messageId);
    }

    // transform
    const contentInstance = plainToInstance(
      BlockMessagePayload,
      JSON.parse(rawContent),
    );

    // validation
    const errors = await validate(contentInstance);
    if (errors.length > 0) {
      throw new InvalidPayloadException(messageId);
    }

    const { blockNumber } = contentInstance;
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
    eachMessagePayload: EachMessagePayload,
    data: { blockNumber: number; transactions: Hash[] },
  ): Promise<void> {
    const messageId = `${this.consumerName}-${eachMessagePayload.topic}-${eachMessagePayload.partition}-${eachMessagePayload.message.offset}`;

    // Send to transaction topic
    const { transactions } = data;
    await sendToTransactionTopic(transactions);
    logger.info(
      `[MessageId: ${messageId}] Sent ${transactions.length} messages to transaction topic.`,
    );

    return super.onFinish(eachMessagePayload, data);
  }
}
