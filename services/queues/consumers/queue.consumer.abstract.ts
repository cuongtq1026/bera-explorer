import type { ConsumeMessage } from "amqplib";

import logger from "../../monitor/logger.ts";
import { DELAY } from "../index.ts";
import mqConnection from "../rabbitmq.connection.ts";

export abstract class IQueueConsumer {
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
        .map(() =>
          mqConnection.consume(this.queueName, (message) =>
            this.execute(message),
          ),
        ),
    );
  }

  private async execute(message: ConsumeMessage): Promise<void> {
    logger.info(`[MessageId: ${message.properties.messageId}] Check delay.`);
    await this.checkDelay(message);

    logger.info(
      `[MessageId: ${message.properties.messageId}] Handling message.`,
    );
    await this.handler(message);
  }

  private async checkDelay(message: ConsumeMessage): Promise<void> {
    const { headers } = message.properties;
    if (!headers) {
      return;
    }
    const { redelivered } = message.fields;
    // just delay for the first time
    if (redelivered) {
      return;
    }
    const delay: number | undefined = headers[DELAY];
    if (!delay || !Number.isInteger(delay)) {
      return;
    }

    logger.info(
      `[MessageId: ${message.properties.messageId}] Delaying for ${delay} ms.`,
    );

    await new Promise<void>((resolve) => {
      setTimeout(() => resolve(), delay);
    });
  }

  protected abstract handler(message: ConsumeMessage): Promise<void>;

  protected async onFinish(message: ConsumeMessage, _data: any): Promise<void> {
    logger.info(`[MessageId: ${message.properties.messageId}] Finished.`);
  }
}
