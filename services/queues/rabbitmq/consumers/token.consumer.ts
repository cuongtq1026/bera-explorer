import { TokenProcessor } from "@processors/token.processor.ts";
import type { ConsumeMessage } from "amqplib";
import { plainToInstance } from "class-transformer";
import { validateOrReject } from "class-validator";

import { queues } from "../../../config";
import logger from "../../../monitor/logger.ts";
import { is0xHash } from "../../../utils.ts";
import { QueueTransactionAggregatorPayload } from "../producers";
import { AbstractRabbitMQConsumer } from "./rabbitmq.consumer.abstract.ts";

export class TokenConsumer extends AbstractRabbitMQConsumer {
  protected queueName = queues.TRANSFER.name;

  constructor() {
    super();
  }

  protected async handler(message: ConsumeMessage): Promise<boolean> {
    const rawContent = message.content.toString();
    logger.info(`TokenConsumer message rawContent: ${rawContent}.`);

    // transform
    const contentInstance = plainToInstance(
      QueueTransactionAggregatorPayload,
      JSON.parse(rawContent),
    );

    // validation
    await validateOrReject(contentInstance);
    const { transactionHash } = contentInstance;
    if (!is0xHash(transactionHash)) {
      throw Error(
        `[MessageId ${message.properties.messageId}] Invalid transaction hash.`,
      );
    }

    logger.info(
      `[MessageId: ${message.properties.messageId}] Processing token.`,
    );

    // process
    const processor = new TokenProcessor();
    await processor.process(transactionHash);

    logger.info(
      `[MessageId: ${message.properties.messageId}] Process transfer successful.`,
    );

    return true;
  }
}
