import type { ConsumeMessage } from "amqplib";

import { appLogger } from "../../../monitor/app.logger.ts";
import { queueMessageProcessedCounter } from "../../../monitor/prometheus.ts";
import { AbstractConsumer } from "../../consumer.abstract.ts";
import { DELAY } from "../index.ts";
import mqConnection from "../rabbitmq.connection.ts";

const serviceLogger = appLogger.namespace("AbstractRabbitMQConsumer");

export abstract class AbstractRabbitMQConsumer extends AbstractConsumer<
  boolean,
  ConsumeMessage
> {
  protected abstract queueName: string;
  protected consumerCount = process.env.CONSUMER_PER_CHANNEL
    ? +process.env.CONSUMER_PER_CHANNEL
    : 1;

  protected constructor() {
    super();
  }

  public async consume(): Promise<void> {
    serviceLogger.info(
      `Queue ${this.queueName}: ${this.consumerCount} consumer(s) started.`,
    );

    for (let i = 0; i < this.consumerCount; i++) {
      await mqConnection.consume(this.queueName, (message) =>
        this.execute(message),
      );
    }
  }

  protected async execute(message: ConsumeMessage): Promise<boolean> {
    serviceLogger.info(
      `[MessageId: ${message.properties.messageId}] Check delay.`,
    );
    await this.checkDelay(message);

    serviceLogger.info(
      `[MessageId: ${message.properties.messageId}] Handling message.`,
    );
    const handled = await this.handler(message);
    serviceLogger.info(
      `[MessageId: ${message.properties.messageId}] Handle message successfully.`,
    );

    return handled;
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

    serviceLogger.info(
      `[MessageId: ${message.properties.messageId}] Delaying for ${delay} ms.`,
    );

    await new Promise<void>((resolve) => {
      setTimeout(() => resolve(), delay);
    });
  }

  protected abstract handler(message: ConsumeMessage): Promise<boolean>;

  protected async onFinish(message: ConsumeMessage, _data: any): Promise<void> {
    // Increase prometheus counter
    queueMessageProcessedCounter.inc({
      routingKey: message.fields.routingKey,
    });

    serviceLogger.info(
      `[MessageId: ${message.properties.messageId}] Finished.`,
    );
  }
}
