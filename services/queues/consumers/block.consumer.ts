import type { ConsumeMessage } from "amqplib";
import { plainToInstance } from "class-transformer";
import { validateOrReject } from "class-validator";
import type { Hash } from "viem";

import { queues } from "../../config";
import logger from "../../monitor/logger.ts";
import { processBlock } from "../../processors";
import { QueueBlockPayload, QueueTransactionPayload } from "../producers";
import mqConnection from "../rabbitmq.connection.ts";
import { IQueueConsumer } from "./queue.consumer.abstract.ts";

export class BlockConsumer extends IQueueConsumer {
  protected queueName = queues.BLOCK_QUEUE.name;

  protected async handler(message: ConsumeMessage): Promise<void> {
    const rawContent = message.content.toString();
    logger.info(`BlockConsumer message rawContent: ${rawContent}.`);

    // transform
    const contentInstance = plainToInstance(
      QueueBlockPayload,
      JSON.parse(rawContent),
    );

    // validation
    await validateOrReject(contentInstance);
    const blockNumber = BigInt(contentInstance.blockNumber);

    // process
    const block = await processBlock(blockNumber);

    // onFinish
    await this.onFinish(message, block);
  }

  protected async onFinish(
    message: ConsumeMessage,
    data: { transactions: Hash[] },
  ): Promise<void> {
    // Queue to transaction queue
    const { transactions } = data;
    await Promise.all(
      transactions.map((transactionHash) => {
        logger.info(
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
