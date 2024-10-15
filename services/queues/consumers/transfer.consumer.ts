import { AbstractRabbitMQConsumer } from "@consumers/rabbitmq.consumer.abstract.ts";
import {
  type CreatedHash,
  TransferProcessor,
} from "@processors/transfer.processor.ts";
import type { ConsumeMessage } from "amqplib";
import { plainToInstance } from "class-transformer";
import { validateOrReject } from "class-validator";

import { queues } from "../../config";
import logger from "../../monitor/logger.ts";
import { is0xHash } from "../../utils.ts";
import { sendToBalanceTopic } from "../kafka/kafka.producer.ts";
import { QueueTransactionAggregatorPayload } from "../producers";

/**
 * @deprecated
 *
 * No longer used due to design flaws
 */
export class TransferConsumer extends AbstractRabbitMQConsumer {
  protected queueName = queues.TRANSFER.name;

  constructor() {
    super();
  }

  protected async handler(message: ConsumeMessage): Promise<boolean> {
    const rawContent = message.content.toString();
    logger.info(`TransferConsumer message rawContent: ${rawContent}.`);

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
      `[MessageId: ${message.properties.messageId}] Processing transfer.`,
    );

    // process
    const processor = new TransferProcessor();
    const result = await processor.process(transactionHash);

    logger.info(
      `[MessageId: ${message.properties.messageId}] Process transfer successful.`,
    );

    // onFinish
    await this.onFinish(message, result);

    return true;
  }

  protected async onFinish(
    message: ConsumeMessage,
    createdHashes: CreatedHash[],
  ): Promise<void> {
    // Queue to balance kafka topic
    for (const createdHash of createdHashes) {
      await sendToBalanceTopic(createdHash.hash);
    }

    return super.onFinish(message, createdHashes);
  }
}
