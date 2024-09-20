import type { ConsumeMessage } from "amqplib";
import { plainToInstance } from "class-transformer";
import { validateOrReject } from "class-validator";

import { queues } from "../../config";
import { processBlock } from "../../processors";
import { QueueBlockPayload } from "../producers";
import mqConnection from "../rabbitmq.connection.ts";

abstract class IQueueConsumer {
  protected abstract queueName: string;

  public async consume(): Promise<void> {
    await mqConnection.consume(this.queueName, this.handler);
  }

  protected abstract handler(message: ConsumeMessage | null): Promise<void>;
}

export class BlockConsumer extends IQueueConsumer {
  protected queueName = queues.BLOCK_QUEUE;

  protected async handler(message: ConsumeMessage | null): Promise<void> {
    if (!message) {
      return console.error(`Invalid incoming message`);
    }

    const rawContent = message.content.toString();
    console.log(`BlockConsumer message rawContent: ${rawContent}.`);

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
