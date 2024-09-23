import type { ConsumeMessage } from "amqplib";
import { plainToInstance } from "class-transformer";
import { validateOrReject } from "class-validator";

import { queues } from "../../config";
import logger from "../../monitor/logger.ts";
import { processBlock } from "../../processors";
import { QueueBlockPayload } from "../producers";
import mqConnection from "../rabbitmq.connection.ts";

abstract class IQueueConsumer {
  protected abstract queueName: string;
  protected consumerCount = process.env.CONSUMER_PER_CHANNEL
    ? +process.env.CONSUMER_PER_CHANNEL
    : 1;

  public async consume(): Promise<void> {
    logger.info(
      `Queue ${this.queueName} ${this.consumerCount} consumer started.`,
    );

    await Promise.all(
      new Array(this.consumerCount)
        .fill(0)
        .map(() => mqConnection.consume(this.queueName, this.handler)),
    );
  }

  protected abstract handler(message: ConsumeMessage | null): Promise<void>;
}

export class BlockConsumer extends IQueueConsumer {
  protected queueName = queues.BLOCK_QUEUE.name;

  protected async handler(message: ConsumeMessage | null): Promise<void> {
    if (!message) {
      return logger.error(`Invalid incoming message`);
    }

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
    await processBlock(blockNumber);
  }
}
