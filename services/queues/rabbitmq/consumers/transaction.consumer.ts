import { TransactionProcessor } from "@processors/transaction.processor.ts";
import type { ConsumeMessage } from "amqplib";
import { plainToInstance } from "class-transformer";
import { validateOrReject } from "class-validator";
import type { Hash } from "viem";

import { queues } from "../../../config";
import { appLogger } from "../../../monitor/app.logger.ts";
import { is0xHash } from "../../../utils.ts";
import {
  QueueInternalTransactionPayload,
  QueueTransactionPayload,
  QueueTransactionReceiptPayload,
} from "../producers";
import mqConnection from "../rabbitmq.connection.ts";
import { AbstractRabbitMQConsumer } from "./rabbitmq.consumer.abstract.ts";

const serviceLogger = appLogger.namespace("TransactionConsumer");

export class TransactionConsumer extends AbstractRabbitMQConsumer {
  protected queueName = queues.TRANSACTION_QUEUE.name;

  constructor() {
    super({
      logger: appLogger.namespace(TransactionConsumer.name),
    });
  }

  public async handler(message: ConsumeMessage): Promise<boolean> {
    const rawContent = message.content.toString();
    serviceLogger.info(
      `TransactionConsumer message rawContent: ${rawContent}.`,
    );

    // transform
    const contentInstance = plainToInstance(
      QueueTransactionPayload,
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
      `[MessageId: ${message.properties.messageId}] Processing transaction.`,
    );

    // process
    const processor = new TransactionProcessor();
    await processor.process(transactionHash);

    serviceLogger.info(
      `[MessageId: ${message.properties.messageId}] Process transaction successful.`,
    );

    // onFinish
    await this.onFinish(message, transactionHash);

    return true;
  }

  public async onFinish(
    message: ConsumeMessage,
    transactionHash: Hash,
  ): Promise<void> {
    // Queue to transaction receipt queue
    await mqConnection.publishToCrawlerExchange(
      queues.TRANSACTION_RECEIPT_QUEUE.routingKey,
      {
        transactionHash,
      } as QueueTransactionReceiptPayload,
    );
    // Queue to internal transaction queue
    await mqConnection.publishToCrawlerExchange(
      queues.INTERNAL_TRANSACTION_QUEUE.routingKey,
      {
        transactionHash,
      } as QueueInternalTransactionPayload,
    );

    return super.onFinish(message, transactionHash);
  }
}
