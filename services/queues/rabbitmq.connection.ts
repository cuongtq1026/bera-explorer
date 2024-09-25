import client, {
  type Channel,
  type Connection,
  type ConsumeMessage,
} from "amqplib";
import { v4 as uuidv4 } from "uuid";

import {
  DEAD_LETTER_EXCHANGE_NAME,
  DEAD_LETTER_QUEUE_NAME,
  queues,
} from "../config";
import logger from "../monitor/logger.ts";
import {
  EXPONENTIAL_BACKOFF,
  EXPONENTIAL_BACKOFF_IN_SECONDS,
  MAX_RETRIES,
  type PublishOptions,
  RETRY_COUNT,
} from "./index.ts";

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
      logger.info(`✅  Rabbit MQ Connection is ready`);

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
          `Channel individual prefetch is set to ${individualConsumeLimit}.`,
        );
      }

      // Dead letter exchange
      const dlx = await this.channel.assertExchange(
        DEAD_LETTER_EXCHANGE_NAME,
        "topic",
        {
          durable: true,
        },
      );
      // Create a Dead letter queue
      const dlq = await this.channel.assertQueue(DEAD_LETTER_QUEUE_NAME, {
        durable: true,
      });
      await this.channel.bindQueue(dlq.queue, dlx.exchange, "#");

      // Crawler exchange
      const crawlerExchange = await this.channel.assertExchange(
        this.crawlerExchangeName,
        "direct",
        {
          durable: true,
        },
      );

      // Assertion
      await Promise.all(
        Object.values(queues).map(async (queueInfo) => {
          await this.channel.assertQueue(queueInfo.name, {
            deadLetterExchange: dlx.exchange,
            deadLetterRoutingKey: queueInfo.routingKey,
            arguments: {
              "x-queue-type": "quorum",
            },
            durable: true,
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

  public async publishToCrawlerExchange(
    routingKey: string,
    message: any,
    options?: PublishOptions,
  ) {
    try {
      await this.checkConnection();

      this.channel.publish(
        this.crawlerExchangeName,
        routingKey,
        Buffer.from(JSON.stringify(message)),
        {
          messageId: uuidv4(),
          headers: {
            [RETRY_COUNT]: MAX_RETRIES,
            [EXPONENTIAL_BACKOFF]: EXPONENTIAL_BACKOFF_IN_SECONDS,
          },
          ...options,
        },
      );
    } catch (error) {
      logger.error(`publishToCrawlerExchange error: ${error}`);
      throw error;
    }
  }

  async consume(
    queueName: string,
    handler: (msg: ConsumeMessage) => Promise<void>,
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
          logger.error(
            `[MessageId: ${message.properties.messageId}} | ${queueName}] Queue consumer error: ${e}`,
          );

          // in dlx, just ack if processing successfully
          if (message.fields.exchange === DEAD_LETTER_EXCHANGE_NAME) {
            this.channel.nack(message, false, true);
            return;
          }

          // re-deliver at least once
          if (!message.fields.redelivered) {
            this.channel.nack(message, false, true);
            return;
          }

          /** check retry count **/
          // If "headers" is not present, retry is not supported
          const { headers } = message.properties;
          if (!headers) {
            this.channel.reject(message, false);
            return;
          }
          const deliveryCount: number = headers["x-delivery-count"] ?? 0;

          // check retries
          {
            const maxRetries: number = headers[RETRY_COUNT] ?? MAX_RETRIES;

            if (deliveryCount >= maxRetries) {
              this.channel.reject(message, false);
              return;
            }
          }

          // handle exponential backoff
          {
            const delayRate: number =
              headers[EXPONENTIAL_BACKOFF] ?? EXPONENTIAL_BACKOFF_IN_SECONDS;
            const delay = Math.pow(delayRate, deliveryCount);

            if (delay) {
              await new Promise<void>((resolve) => {
                setTimeout(() => resolve(), delay * 1000);
              });
            }
          }

          this.channel.nack(message, false, true);
        }
      },
      { noAck: false },
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
