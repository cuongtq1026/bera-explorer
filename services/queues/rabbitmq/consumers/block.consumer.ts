import { BlockProcessor } from "@processors/block.processor.ts";
import type { ConsumeMessage } from "amqplib";
import { plainToInstance } from "class-transformer";
import { validateOrReject } from "class-validator";
import type { Hash } from "viem";

import { queues } from "../../../config";
import { appLogger } from "../../../monitor/app.logger.ts";
import { QueueBlockPayload, QueueTransactionPayload } from "../producers";
import mqConnection from "../rabbitmq.connection.ts";
import { AbstractRabbitMQConsumer } from "./rabbitmq.consumer.abstract.ts";

const serviceLogger = appLogger.namespace("BlockConsumer");

export class BlockConsumer extends AbstractRabbitMQConsumer {
  protected queueName = queues.BLOCK_QUEUE.name;

  constructor() {
    super();
  }

  protected async handler(message: ConsumeMessage): Promise<boolean> {
    const rawContent = message.content.toString();
    serviceLogger.info(`message rawContent: ${rawContent}.`);

    // transform
    const contentInstance = plainToInstance(
      QueueBlockPayload,
      JSON.parse(rawContent),
    );

    // validation
    await validateOrReject(contentInstance);
    const blockNumber = BigInt(contentInstance.blockNumber);

    // process
    const processor = new BlockProcessor();
    const block = await processor.process(blockNumber);

    // onFinish
    await this.onFinish(message, block);

    return true;
  }

  protected async onFinish(
    message: ConsumeMessage,
    data: { transactions: Hash[] },
  ): Promise<void> {
    // Queue to transaction queue
    const { transactions } = data;
    await Promise.all(
      transactions.map((transactionHash) => {
        serviceLogger.info(
          `[MessageId: ${message.properties.messageId}] Published to transaction queue transactionHash: ${transactionHash}.`,
        );

        return mqConnection.publishToCrawlerExchange(
          queues.TRANSACTION_QUEUE.routingKey,
          {
            transactionHash,
          } as QueueTransactionPayload,
        );
      }),
    );

    return super.onFinish(message, data);
  }
}
