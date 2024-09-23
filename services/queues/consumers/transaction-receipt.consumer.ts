import type { ConsumeMessage } from "amqplib";
import { plainToInstance } from "class-transformer";
import { validateOrReject } from "class-validator";

import { queues } from "../../config";
import logger from "../../monitor/logger.ts";
import { processTransactionReceipt } from "../../processors";
import { is0xHash } from "../../utils.ts";
import { QueueTransactionPayload } from "../producers";
import { IQueueConsumer } from "./queue.consumer.abstract.ts";

export class TransactionReceiptConsumer extends IQueueConsumer {
  protected queueName = queues.TRANSACTION_RECEIPT_QUEUE.name;

  protected async handler(message: ConsumeMessage): Promise<void> {
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
    await processTransactionReceipt(transactionHash);

    // onFinish
    await this.onFinish(message, transactionHash);
  }
}
