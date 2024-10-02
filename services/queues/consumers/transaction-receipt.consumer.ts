import { AbstractRabbitMQConsumer } from "@consumers/rabbitmq.consumer.abstract.ts";
import { TransactionReceiptProcessor } from "@processors/transaction-receipt.processor.ts";
import type { ConsumeMessage } from "amqplib";
import { plainToInstance } from "class-transformer";
import { validateOrReject } from "class-validator";
import type { Hash } from "viem";

import {
  AGGREGATOR_TRANSACTION_ROUTING_KEY,
  aggregatorExchangeName,
  queues,
} from "../../config";
import logger from "../../monitor/logger.ts";
import { is0xHash } from "../../utils.ts";
import {
  QueueTransactionAggregatorPayload,
  QueueTransactionPayload,
} from "../producers";
import mqConnection from "../rabbitmq.connection.ts";

export class TransactionReceiptConsumer extends AbstractRabbitMQConsumer {
  protected queueName = queues.TRANSACTION_RECEIPT_QUEUE.name;

  constructor() {
    super();
  }

  protected async handler(message: ConsumeMessage): Promise<boolean> {
    const rawContent = message.content.toString();
    logger.info(
      `TransactionReceiptConsumer message rawContent: ${rawContent}.`,
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

    // process
    const processor = new TransactionReceiptProcessor();
    await processor.process(transactionHash);

    // onFinish
    await this.onFinish(message, transactionHash);

    return true;
  }

  protected async onFinish(
    message: ConsumeMessage,
    transactionHash: Hash,
  ): Promise<void> {
    // Publish aggregator exchange
    await mqConnection.publishFanoutExchange(
      aggregatorExchangeName,
      AGGREGATOR_TRANSACTION_ROUTING_KEY,
      {
        transactionHash,
      } as QueueTransactionAggregatorPayload,
    );

    return super.onFinish(message, transactionHash);
  }
}
