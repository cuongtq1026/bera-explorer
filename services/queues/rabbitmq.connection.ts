import client, {
  type Channel,
  type Connection,
  type ConsumeMessage,
} from "amqplib";

import { queues } from "../config";
import logger from "../monitor/logger.ts";

class RabbitMQConnection {
  connection!: Connection;
  channel!: Channel;
  private connected!: boolean;
  private readonly crawlerExchangeName = "crawler";

  async connect() {
    const connectionUrl = process.env.RABBIT_MQ_CONNECTION;
    if (!connectionUrl) {
      throw Error("No connection URL provided");
    }

    if (this.connected && this.channel) return;
    else this.connected = true;

    try {
      logger.info(`⌛️ Connecting to Rabbit-MQ Server`);
      this.connection = await client.connect(connectionUrl);
      logger.info(`✅ Rabbit MQ Connection is ready`);

      this.channel = await this.connection.createChannel();
      logger.info(`🛸 Created RabbitMQ Channel successfully`);

      // Configuration
      {
        const globalConsumeLimit = process.env.GLOBAL_CONSUME_LIMIT
          ? parseInt(process.env.GLOBAL_CONSUME_LIMIT!)
          : 0;

        await this.channel.prefetch(globalConsumeLimit, true);
        logger.info(`Channel global prefetch is set to ${globalConsumeLimit}.`);
        const individualConsumeLimit = process.env.INDIVIDUAL_CONSUMER_LIMIT
          ? parseInt(process.env.INDIVIDUAL_CONSUMER_LIMIT!)
          : 0;

        await this.channel.prefetch(individualConsumeLimit, false);
        logger.info(
          `Channel individual prefetch is set to ${globalConsumeLimit}.`,
        );
      }

      // Dead letter exchange
      const dlx = await this.channel.assertExchange("dead-letter", "topic");
      // Create a Dead letter queue
      const dlq = await this.channel.assertQueue("dead-letter-queue", {
        durable: true,
      });
      await this.channel.bindQueue(dlq.queue, dlx.exchange, "#");

      // Crawler exchange
      const crawlerExchange = await this.channel.assertExchange(
        this.crawlerExchangeName,
        "direct",
      );

      // Assertion
      await Promise.all(
        Object.values(queues).map(async (queueInfo) => {
          await this.channel.assertQueue(queueInfo.name, {
            deadLetterExchange: dlx.exchange,
            deadLetterRoutingKey: queueInfo.routingKey,
          });

          await this.channel.bindQueue(
            queueInfo.name,
            crawlerExchange.exchange,
            queueInfo.routingKey,
          );
        }),
      );
      logger.info(`Asserted all queues to RabbitMQ.`);
    } catch (error) {
      logger.error(error);
      logger.error(`Not connected to MQ Server`);

      throw error;
    }
  }

  async sendToQueue(queueName: string, message: any) {
    try {
      await this.checkConnection();

      this.channel.sendToQueue(queueName, Buffer.from(JSON.stringify(message)));
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  async publishToCrawlerExchange(routingKey: string, message: any) {
    try {
      await this.checkConnection();

      this.channel.publish(
        this.crawlerExchangeName,
        routingKey,
        Buffer.from(JSON.stringify(message)),
      );
    } catch (error) {
      logger.error(`publishToCrawlerExchange error: ${error}`);
      throw error;
    }
  }

  async consume(
    queueName: string,
    handler: (msg: ConsumeMessage | null) => Promise<void>,
  ) {
    await this.checkConnection();

    await this.channel.consume(
      queueName,
      async (message: ConsumeMessage | null) => {
        if (!message) {
          return logger.error(`Invalid incoming message`);
        }

        try {
          await handler(message);

          this.channel.ack(message);
        } catch (e) {
          logger.error(`[${queueName}] Queue consumer error: ${e}`);

          this.channel.reject(message, false);
        }
      },
    );
  }

  private async checkConnection(): Promise<void> {
    if (this.channel) {
      return;
    }
    await this.connect();
  }
}

const mqConnection = new RabbitMQConnection();

export default mqConnection;
