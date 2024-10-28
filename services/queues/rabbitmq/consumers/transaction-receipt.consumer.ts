import { TransactionReceiptProcessor } from "@processors/transaction-receipt.processor.ts";
import type { ConsumeMessage } from "amqplib";
import { plainToInstance } from "class-transformer";
import { validateOrReject } from "class-validator";
import type { Hash } from "viem";

import {
  AGGREGATOR_TRANSACTION_ROUTING_KEY,
  aggregatorExchangeName,
  queues,
} from "../../../config";
import { appLogger } from "../../../monitor/app.logger.ts";
import { is0xHash } from "../../../utils.ts";
import {
  QueueTransactionAggregatorPayload,
  QueueTransactionPayload,
} from "../producers";
import mqConnection from "../rabbitmq.connection.ts";
import { AbstractRabbitMQConsumer } from "./rabbitmq.consumer.abstract.ts";

const serviceLogger = appLogger.namespace("TransactionReceiptConsumer");

export class TransactionReceiptConsumer extends AbstractRabbitMQConsumer {
  protected queueName = queues.TRANSACTION_RECEIPT_QUEUE.name;

  constructor() {
    super({
      logger: appLogger.namespace(TransactionReceiptConsumer.name),
    });
  }

  public async handler(message: ConsumeMessage): Promise<boolean> {
    const rawContent = message.content.toString();
    serviceLogger.info(`message rawContent: ${rawContent}.`);

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

  public async onFinish(
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
