import { InternalTransactionProcessor } from "@processors/internal-transaction.processor.ts";
import type { ConsumeMessage } from "amqplib";
import { plainToInstance } from "class-transformer";
import { validateOrReject } from "class-validator";

import { queues } from "../../config";
import logger from "../../monitor/logger.ts";
import { is0xHash } from "../../utils.ts";
import { QueueInternalTransactionPayload } from "../producers";
import { IQueueConsumer } from "./queue.consumer.abstract.ts";

export class InternalTransactionConsumer extends IQueueConsumer {
  protected queueName = queues.INTERNAL_TRANSACTION_QUEUE.name;

  constructor() {
    super();
  }

  protected async handler(message: ConsumeMessage): Promise<boolean> {
    const rawContent = message.content.toString();
    logger.info(
      `InternalTransactionConsumer message rawContent: ${rawContent}.`,
    );

    // transform
    const contentInstance = plainToInstance(
      QueueInternalTransactionPayload,
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
    const processor = new InternalTransactionProcessor();
    await processor.process(transactionHash);

    // onFinish
    await this.onFinish(message, transactionHash);

    return true;
  }
}
