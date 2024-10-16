import prisma from "@database/prisma.ts";
import { LogProcessor } from "@processors/log.processor.ts";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import type { EachMessagePayload } from "kafkajs";
import type { Hash } from "viem";

import {
  InvalidPayloadException,
  PayloadNotFoundException,
} from "../../../exceptions/consumer.exception.ts";
import logger from "../../../monitor/logger.ts";
import { LogMessagePayload, topics } from "../index.ts";
import { sendToTransactionTopic, sendToTransferTopic } from "../producers";
import { AbstractKafkaConsumer } from "./kafka.consumer.abstract.ts";

export class LogKafkaConsumer extends AbstractKafkaConsumer {
  protected topicName = topics.LOG.name;

  constructor() {
    super();
  }

  protected async handler(
    eachMessagePayload: EachMessagePayload,
  ): Promise<void> {
    const messageId = `${eachMessagePayload.topic}-${eachMessagePayload.partition}-${eachMessagePayload.message.offset}`;

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

    // if transfer doesn't exist, process to save it
    const processor = new LogProcessor();
    const { transferHash } = await processor.process(logHash as Hash);

    await this.onFinish(eachMessagePayload, {
      transferHash,
    });
  }

  protected async onFinish(
    eachMessagePayload: EachMessagePayload,
    data: { transferHash: string | null },
  ): Promise<void> {
    const { transferHash } = data;

    if (!transferHash) {
      return super.onFinish(eachMessagePayload, data);
    }

    const messageId = `${eachMessagePayload.topic}-${eachMessagePayload.partition}-${eachMessagePayload.message.offset}`;

    // Send to log topic
    await sendToTransferTopic([transferHash]);
    logger.info(
      `[MessageId: ${messageId}] Sent ${transferHash} message to transfer topic.`,
    );
    return super.onFinish(eachMessagePayload, data);
  }
}
