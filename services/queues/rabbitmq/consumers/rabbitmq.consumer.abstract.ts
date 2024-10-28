import type { ConsumeMessage } from "amqplib";

import { queueMessageProcessedCounter } from "../../../monitor/prometheus.ts";
import type { IConsumer } from "../../consumer.interface.ts";
import { AbstractInjectLogger } from "../../kafka/inject-logger.abstract.ts";
import { DELAY } from "../index.ts";
import mqConnection from "../rabbitmq.connection.ts";

export abstract class AbstractRabbitMQConsumer
  extends AbstractInjectLogger
  implements IConsumer<boolean, ConsumeMessage>
{
  protected abstract queueName: string;
  protected consumerCount = process.env.CONSUMER_PER_CHANNEL
    ? +process.env.CONSUMER_PER_CHANNEL
    : 1;

  public async consume(): Promise<void> {
    this.serviceLogger.info(
      `Queue ${this.queueName}: ${this.consumerCount} consumer(s) started.`,
    );

    for (let i = 0; i < this.consumerCount; i++) {
      await mqConnection.consume(this.queueName, (message) =>
        this.execute(message),
      );
    }
  }

  public async execute(message: ConsumeMessage): Promise<boolean> {
    this.serviceLogger.info(
      `[MessageId: ${message.properties.messageId}] Check delay.`,
    );
    await this.checkDelay(message);

    this.serviceLogger.info(
      `[MessageId: ${message.properties.messageId}] Handling message.`,
    );
    const handled = await this.handler(message);
    this.serviceLogger.info(
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

    this.serviceLogger.info(
      `[MessageId: ${message.properties.messageId}] Delaying for ${delay} ms.`,
    );

    await new Promise<void>((resolve) => {
      setTimeout(() => resolve(), delay);
    });
  }

  public abstract handler(message: ConsumeMessage): Promise<boolean>;

  public async onFinish(message: ConsumeMessage, _data: any): Promise<void> {
    // Increase prometheus counter
    queueMessageProcessedCounter.inc({
      routingKey: message.fields.routingKey,
    });

    this.serviceLogger.info(
      `[MessageId: ${message.properties.messageId}] Finished.`,
    );
  }
}
