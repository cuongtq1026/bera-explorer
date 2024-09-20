import client, {
  type Channel,
  type Connection,
  type ConsumeMessage,
} from "amqplib";

import { queues } from "../config";

class RabbitMQConnection {
  connection!: Connection;
  channel!: Channel;
  private connected!: boolean;

  async connect() {
    const connectionUrl = process.env.RABBIT_MQ_CONNECTION;
    if (!connectionUrl) {
      throw Error("No connection URL provided");
    }

    if (this.connected && this.channel) return;
    else this.connected = true;

    try {
      console.log(`⌛️ Connecting to Rabbit-MQ Server`);
      this.connection = await client.connect(connectionUrl);

      console.log(`✅ Rabbit MQ Connection is ready`);

      this.channel = await this.connection.createChannel();

      console.log(`🛸 Created RabbitMQ Channel successfully`);

      await Promise.all(
        Object.values(queues).map(async (queueName) => {
          await this.channel.assertQueue(queueName);
        }),
      );
      console.log(`Asserted all queues to RabbitMQ.`);
    } catch (error) {
      console.error(error);
      console.error(`Not connected to MQ Server`);
    }
  }

  async sendToQueue(queue: string, message: any) {
    try {
      await this.checkConnection();

      this.channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)));
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async consume(
    queueName: string,
    handler: (msg: ConsumeMessage | null) => Promise<void>,
  ) {
    await this.checkConnection();

    await this.channel.assertQueue(queueName, {
      durable: true,
    });

    await this.channel.consume(
      queueName,
      async (message: ConsumeMessage | null) => {
        if (!message) {
          return console.error(`Invalid incoming message`);
        }

        try {
          await handler(message);

          this.channel.ack(message);
        } catch (e) {
          console.error(`[${queueName}] Queue consumer error: ${e}`);

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
