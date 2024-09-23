import type { ConsumeMessage } from "amqplib";
import { plainToInstance } from "class-transformer";
import { validateOrReject } from "class-validator";

import { queues } from "../../config";
import logger from "../../monitor/logger.ts";
import { processBlock } from "../../processors";
import { QueueBlockPayload } from "../producers";
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
    await processBlock(blockNumber);
  }
}
