import prisma from "@database/prisma.ts";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import type { EachMessagePayload } from "kafkajs";

import {
  InvalidPayloadException,
  KafkaReachedEndIndexedOffset,
  PayloadNotFoundException,
} from "../../../exceptions/consumer.exception.ts";
import logger from "../../../monitor/logger.ts";
import { LogMessagePayload, topics } from "../index.ts";
import { sendToTransferTopic } from "../producers";
import { AbstractKafkaConsumer } from "./kafka.consumer.abstract.ts";

export class TransferKafkaConsumer extends AbstractKafkaConsumer {
  protected topicName = topics.LOG.name;
  protected consumerName = "transfer";

  constructor() {
    super();
  }

  protected async handler(
    eachMessagePayload: EachMessagePayload,
  ): Promise<void> {
    const messageId = `${this.consumerName}-${eachMessagePayload.topic}-${eachMessagePayload.partition}-${eachMessagePayload.message.offset}`;

    const rawContent = eachMessagePayload.message.value?.toString();
    logger.info(
      `[MessageId: ${messageId}] LogKafkaConsumer message rawContent: ${rawContent}.`,
    );

    if (!rawContent) {
      throw new PayloadNotFoundException(messageId);
    }

    // transform
    const contentInstance = plainToInstance(
      LogMessagePayload,
      JSON.parse(rawContent),
    );

    // validation
    const errors = await validate(contentInstance);
    if (errors.length > 0) {
      throw new InvalidPayloadException(messageId);
    }

    const { logHash } = contentInstance;

    // process from db if already existed
    const logDb = await prisma.log.findUnique({
      where: {
        logHash,
      },
      include: {
        transfer: {
          select: {
            hash: true,
          },
        },
      },
    });

    if (logDb == null) {
      throw Error("Log is not found.");
    }
    // if transfer exist, finish
    if (logDb.transfer) {
      await this.onFinish(eachMessagePayload, {
        transferHash: logDb.transfer ? logDb.transfer.hash : null,
      });
      return;
    }

    // TODO: Wait until data indexed
    throw new KafkaReachedEndIndexedOffset(
      eachMessagePayload.topic,
      this.consumerName,
      logHash,
    );
  }

  protected async onFinish(
    eachMessagePayload: EachMessagePayload,
    data: { transferHash: string | null },
  ): Promise<void> {
    const { transferHash } = data;

    if (!transferHash) {
      return super.onFinish(eachMessagePayload, data);
    }

    const messageId = `${this.consumerName}-${eachMessagePayload.topic}-${eachMessagePayload.partition}-${eachMessagePayload.message.offset}`;

    // Send to log topic
    await sendToTransferTopic([transferHash]);
    logger.info(
      `[MessageId: ${messageId}] Sent ${transferHash} message to transfer topic.`,
    );
    return super.onFinish(eachMessagePayload, data);
  }
}
