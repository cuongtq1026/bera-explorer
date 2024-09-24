import type { ConsumeMessage } from "amqplib";
import http from "http";

import logger from "../../monitor/logger.ts";
import {
  prometheusRegistry,
  queueMessageProcessedCounter,
} from "../../monitor/prometheus.ts";
import { DELAY } from "../index.ts";
import mqConnection from "../rabbitmq.connection.ts";

export abstract class IQueueConsumer {
  protected abstract queueName: string;
  protected consumerCount = process.env.CONSUMER_PER_CHANNEL
    ? +process.env.CONSUMER_PER_CHANNEL
    : 1;

  protected constructor() {
    this.setupPrometheus();
  }

  private setupPrometheus() {
    const server = http.createServer(async (req, res) => {
      if (!req.url) {
        res.end();
        return;
      }

      const route = req.url;
      if (route === "/metrics") {
        res.setHeader("Content-Type", prometheusRegistry.contentType);
        res.end(await prometheusRegistry.metrics());
      }
    });

    const exporterPort = process.env.EXPORTER_PORT
      ? +process.env.EXPORTER_PORT
      : 4000;
    server.listen(exporterPort);
    logger.info(`✅  [Prometheus] Server is running on port ${exporterPort}`);
  }

  public async consume(): Promise<void> {
    logger.info(
      `Queue ${this.queueName}: ${this.consumerCount} consumer(s) started.`,
    );

    for (let i = 0; i < this.consumerCount; i++) {
      await mqConnection.consume(this.queueName, (message) =>
        this.execute(message),
      );
    }
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
    // Increase prometheus counter
    queueMessageProcessedCounter.inc({
      routingKey: message.fields.routingKey,
    });

    logger.info(`[MessageId: ${message.properties.messageId}] Finished.`);
  }
}
