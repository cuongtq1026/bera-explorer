import { TransferKafkaProcessor } from "@processors/transfer-kafka.processor.ts";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import type { EachMessagePayload } from "kafkajs";
import type { Hash } from "viem";

import {
  InvalidPayloadException,
  PayloadNotFoundException,
} from "../../exceptions/consumer.exception.ts";
import logger from "../../monitor/logger.ts";
import { topics, TransferMessagePayload } from "../kafka";
import { AbstractKafkaConsumer } from "./kafka.consumer.abstract.ts";

export class TransferKafkaConsumer extends AbstractKafkaConsumer {
  protected topicName = topics.TRANSFER.name;

  constructor() {
    super();
  }

  protected async handler(
    eachMessagePayload: EachMessagePayload,
  ): Promise<void> {
    const messageId = `${eachMessagePayload.topic}-${eachMessagePayload.partition}-${eachMessagePayload.message.offset}`;

    const rawContent = eachMessagePayload.message.value?.toString();
    logger.info(
      `[MessageId: ${messageId}] TransferKafkaConsumer message rawContent: ${rawContent}.`,
    );

    if (!rawContent) {
      throw new PayloadNotFoundException(messageId);
    }

    // transform
    const contentInstance = plainToInstance(
      TransferMessagePayload,
      JSON.parse(rawContent),
    );

    // validation
    const errors = await validate(contentInstance);
    if (errors.length > 0) {
      throw new InvalidPayloadException(messageId);
    }

    const { transferHash } = contentInstance;

    // process
    const transferProcessor = new TransferKafkaProcessor();
    await transferProcessor.process(transferHash as Hash);
  }
}
