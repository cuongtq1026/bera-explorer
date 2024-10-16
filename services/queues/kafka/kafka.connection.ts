import {
  type Admin,
  type EachMessageHandler,
  Kafka,
  logLevel,
  type Message,
  Partitioners,
  type Producer,
} from "kafkajs";

import logger from "../../monitor/logger.ts";
import { topics } from "./index.ts";

export const toWinstonLogLevel = (level: logLevel) => {
  switch (level) {
    case logLevel.ERROR:
    case logLevel.NOTHING:
      return "error";
    case logLevel.WARN:
      return "warn";
    case logLevel.INFO:
      return "info";
    case logLevel.DEBUG:
      return "debug";
  }
};

export class KafkaConnection {
  private connection: Kafka;
  private connected!: boolean;
  private producer!: Producer;
  private admin!: Admin;

  async connect() {
    const kafkaBrokerUrl = process.env.KAFKA_BROKER_CONNECTION;
    if (!kafkaBrokerUrl) {
      throw Error("No Kafka connection URL provided");
    }

    if (this.connected && this.producer) return;
    else this.connected = true;

    try {
      this.connection = new Kafka({
        clientId: "bera-explorer",
        brokers: [kafkaBrokerUrl],
        logCreator:
          () =>
          ({ level, log }) => {
            const { message, ...extra } = log;
            logger.log({
              level: toWinstonLogLevel(level),
              message: message,
              extra,
            });
          },
      });

      this.producer = this.connection.producer({
        createPartitioner: Partitioners.DefaultPartitioner,
      });

      logger.info(`⌛️ Connecting to Kafka Producer`);
      await this.producer.connect();
      logger.info(`✅  Kafka Producer is ready`);

      this.admin = this.connection.admin();
      logger.info(`⌛️ Connecting to Kafka Admin`);
      await this.admin.connect();
      logger.info(`✅  Kafka Admin is ready`);
      const existingTopics = await this.admin.listTopics();
      await this.admin.createTopics({
        topics: Object.values(topics)
          .filter((topic) => !existingTopics.includes(topic.name))
          .map((topic) => ({
            topic: topic.name,
            numPartitions: 1,
            replicationFactor: 1,
          })),
      });
      logger.info(`Kafka topics created`);
    } catch (error) {
      logger.error(error);
      logger.error(`Not connected to Kafka server`);

      throw error;
    }
  }

  private async checkConnection(): Promise<void> {
    if (this.producer) {
      return;
    }
    await this.connect();
  }

  public async send<T extends Message = Message>(topic: string, messages: T[]) {
    await this.checkConnection();

    await this.producer.send({
      topic: topic,
      messages: messages,
    });
  }

  public async consume({
    topic,
    groupId,
    eachMessageHandler,
  }: {
    topic: string;
    groupId: string;
    eachMessageHandler: EachMessageHandler;
  }) {
    await this.checkConnection();

    const envGroupId = process.env.KAFKA_GROUP_ID;
    if (!envGroupId) {
      throw new Error(`Missing KAFKA_GROUP_ID`);
    }
    const groupIdTopic = [envGroupId, groupId, topic].join("-");
    const consumer = this.connection.consumer({
      groupId: groupIdTopic,
    });
    await consumer.subscribe({
      topic,
      fromBeginning: true,
    });

    await consumer.run({
      autoCommit: true,
      autoCommitInterval: 1000,
      autoCommitThreshold: 10,
      eachMessage: eachMessageHandler,
    });
  }
}

const kafkaConnection = new KafkaConnection();

export default kafkaConnection;
