import type { ConsumeMessage } from "amqplib";

import { DEAD_LETTER_QUEUE_NAME } from "../../../config";
import { appLogger } from "../../../monitor/app.logger.ts";
import mqConnection from "../rabbitmq.connection.ts";
import { AbstractRabbitMQConsumer } from "./rabbitmq.consumer.abstract.ts";

const serviceLogger = appLogger.namespace("DlxConsumer");

export class DlxConsumer extends AbstractRabbitMQConsumer {
  protected queueName: string = DEAD_LETTER_QUEUE_NAME;

  constructor() {
    super();
  }

  protected async handler(message: ConsumeMessage): Promise<boolean> {
    const { headers } = message.properties;
    if (!headers) {
      throw Error("Message must have headers");
    }

    const content = message.content.toString();

    await mqConnection.publishToCrawlerExchange(
      message.fields.routingKey,
      JSON.parse(content),
    );

    serviceLogger.info(
      `Re-published message. Routing key: ${message.fields.routingKey} | Content: ${content}`,
    );

    return true;
  }
}
