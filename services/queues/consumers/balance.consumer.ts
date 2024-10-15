import { AbstractKafkaConsumer } from "@consumers/kafka.consumer.abstract.ts";
import { BalanceProcessor } from "@processors/balance.processor.ts";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import type { EachMessagePayload } from "kafkajs";

import {
  InvalidPayloadException,
  PayloadNotFoundException,
} from "../../exceptions/consumer.exception.ts";
import logger from "../../monitor/logger.ts";
import { BalanceMessagePayload, topics } from "../kafka";

/**
 * @deprecated
 *
 * No longer used due to design flaws
 */
export class BalanceConsumer extends AbstractKafkaConsumer {
  protected topicName = topics.BALANCE.name;

  constructor() {
    super();
  }

  protected async handler(
    eachMessagePayload: EachMessagePayload,
  ): Promise<void> {
    const messageId = `${eachMessagePayload.topic}-${eachMessagePayload.partition}-${eachMessagePayload.message.offset}`;

    const rawContent = eachMessagePayload.message.value?.toString();
    logger.info(
      `[MessageId: ${messageId}] TransactionConsumer message rawContent: ${rawContent}.`,
    );

    if (!rawContent) {
      throw new PayloadNotFoundException(messageId);
    }

    // transform
    const contentInstance = plainToInstance(
      BalanceMessagePayload,
      JSON.parse(rawContent),
    );

    // validation
    const errors = await validate(contentInstance);
    if (errors.length > 0) {
      throw new InvalidPayloadException(messageId);
    }

    // process
    const processor = new BalanceProcessor();
    await processor.process(contentInstance.transferHash);
  }
}
