import { TransactionProcessor } from "@processors/transaction.processor.ts";
import type { ConsumeMessage } from "amqplib";
import { plainToInstance } from "class-transformer";
import { validateOrReject } from "class-validator";
import type { Hash } from "viem";

import { queues } from "../../config";
import logger from "../../monitor/logger.ts";
import { is0xHash } from "../../utils.ts";
import {
  QueueInternalTransactionPayload,
  QueueTransactionPayload,
  QueueTransactionReceiptPayload,
} from "../producers";
import mqConnection from "../rabbitmq.connection.ts";
import { IQueueConsumer } from "./queue.consumer.abstract.ts";

export class TransactionConsumer extends IQueueConsumer {
  protected queueName = queues.TRANSACTION_QUEUE.name;

  constructor() {
    super();
  }

  protected async handler(message: ConsumeMessage): Promise<boolean> {
    const rawContent = message.content.toString();
    logger.info(`TransactionConsumer message rawContent: ${rawContent}.`);

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

    logger.info(
      `[MessageId: ${message.properties.messageId}] Processing transaction.`,
    );

    // process
    const processor = new TransactionProcessor();
    await processor.process(transactionHash);

    logger.info(
      `[MessageId: ${message.properties.messageId}] Process transaction successful.`,
    );

    // onFinish
    await this.onFinish(message, transactionHash);

    return true;
  }

  protected async onFinish(
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
