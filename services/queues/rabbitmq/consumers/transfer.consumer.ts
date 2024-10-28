import {
  type CreatedHash,
  TransferProcessor,
} from "@processors/transfer.processor.ts";
import type { ConsumeMessage } from "amqplib";
import { plainToInstance } from "class-transformer";
import { validateOrReject } from "class-validator";

import { queues } from "../../../config";
import { appLogger } from "../../../monitor/app.logger.ts";
import { is0xHash } from "../../../utils.ts";
import { QueueTransactionAggregatorPayload } from "../producers";
import { AbstractRabbitMQConsumer } from "./rabbitmq.consumer.abstract.ts";

const serviceLogger = appLogger.namespace("TransferConsumer");

export class TransferConsumer extends AbstractRabbitMQConsumer {
  protected queueName = queues.TRANSFER.name;

  constructor() {
    super({
      logger: appLogger.namespace(TransferConsumer.name),
    });
  }

  public async handler(message: ConsumeMessage): Promise<boolean> {
    const rawContent = message.content.toString();
    serviceLogger.info(`message rawContent: ${rawContent}.`);

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

    serviceLogger.info(
      `[MessageId: ${message.properties.messageId}] Processing transfer.`,
    );

    // process
    const processor = new TransferProcessor();
    const result = await processor.process(transactionHash);

    serviceLogger.info(
      `[MessageId: ${message.properties.messageId}] Process transfer successful.`,
    );

    // onFinish
    await this.onFinish(message, result);

    return true;
  }

  public async onFinish(
    message: ConsumeMessage,
    createdHashes: CreatedHash[],
  ): Promise<void> {
    return super.onFinish(message, createdHashes);
  }
}
