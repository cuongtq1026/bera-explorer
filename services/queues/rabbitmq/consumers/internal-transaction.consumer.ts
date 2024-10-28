import { InternalTransactionProcessor } from "@processors/internal-transaction.processor.ts";
import type { ConsumeMessage } from "amqplib";
import { plainToInstance } from "class-transformer";
import { validateOrReject } from "class-validator";

import { queues } from "../../../config";
import { appLogger } from "../../../monitor/app.logger.ts";
import { is0xHash } from "../../../utils.ts";
import { QueueInternalTransactionPayload } from "../producers";
import { AbstractRabbitMQConsumer } from "./rabbitmq.consumer.abstract.ts";

export class InternalTransactionConsumer extends AbstractRabbitMQConsumer {
  protected queueName = queues.INTERNAL_TRANSACTION_QUEUE.name;

  constructor() {
    super({
      logger: appLogger.namespace(InternalTransactionConsumer.name),
    });
  }

  public async handler(message: ConsumeMessage): Promise<boolean> {
    const rawContent = message.content.toString();
    this.serviceLogger.info(`message rawContent: ${rawContent}.`);

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
