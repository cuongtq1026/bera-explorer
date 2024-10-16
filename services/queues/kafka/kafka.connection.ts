import { SchemaRegistry, SchemaType } from "@kafkajs/confluent-schema-registry";
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
import {
  blockSchema,
  logSchema,
  swapSchema,
  transactionSchema,
  transferSchema,
} from "./schemas";

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
  private registry!: SchemaRegistry;
  private schemaMap = new Map<keyof typeof topics, number>();

  async connect() {
    const kafkaBrokerUrl = process.env.KAFKA_BROKER_CONNECTION;
    if (!kafkaBrokerUrl) {
      throw Error("No Kafka connection URL provided");
    }
    const schemaRegistry = process.env.SCHEMA_REGISTRY;
    if (!schemaRegistry) {
      throw Error("No schema registry connection URL provided");
    }

    if (this.connected && this.producer) return;

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

      logger.info(`⌛  Connecting to Kafka Producer`);
      await this.producer.connect();
      logger.info(`✅  Kafka Producer is ready`);

      this.admin = this.connection.admin();
      logger.info(`⌛  Connecting to Kafka Admin`);
      await this.admin.connect();
      logger.info(`✅  Kafka Admin is ready`);
      logger.info(`⌛  Connecting to Schema Registry`);
      this.registry = new SchemaRegistry({ host: schemaRegistry });
      logger.info(`✅  Schema Registry is ready`);
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

      {
        logger.info(`⌛  Creating Registry schemas`);

        const { id: blockSchemaId } = await this.registry.register({
          type: SchemaType.AVRO,
          schema: JSON.stringify(blockSchema),
        });
        this.schemaMap.set("BLOCK", blockSchemaId);

        const { id: logSchemaId } = await this.registry.register({
          type: SchemaType.AVRO,
          schema: JSON.stringify(logSchema),
        });
        this.schemaMap.set("LOG", logSchemaId);

        const { id: swapId } = await this.registry.register({
          type: SchemaType.AVRO,
          schema: JSON.stringify(swapSchema),
        });
        this.schemaMap.set("SWAP", swapId);

        const { id: transactionSchemaId } = await this.registry.register({
          type: SchemaType.AVRO,
          schema: JSON.stringify(transactionSchema),
        });
        this.schemaMap.set("TRANSACTION", transactionSchemaId);

        const { id: transferSchemaId } = await this.registry.register({
          type: SchemaType.AVRO,
          schema: JSON.stringify(transferSchema),
        });
        this.schemaMap.set("TRANSFER", transferSchemaId);

        logger.info(`✅  Schema Registry registered: ${this.schemaMap.size}`);
      }

      // When everything is fully connected, set connected = true
      this.connected = true;
    } catch (error) {
      logger.error(error);
      logger.error(`Failed to connect to Kafka`);

      throw error;
    }
  }

  public async encode(
    schemaName: keyof typeof topics,
    value: any,
  ): Promise<Buffer> {
    await this.checkConnection();

    return this.registry.encode(this.getSchemaId(schemaName), value);
  }

  public async decode(value: Buffer): Promise<Buffer> {
    await this.checkConnection();

    return this.registry.decode(value);
  }

  public getSchemaId(schemaName: keyof typeof topics): number {
    const schema = this.schemaMap.get(schemaName);
    if (schema == null) {
      throw new Error(`No schemaName: ${schemaName}`);
    }
    return schema;
  }

  private promise: Promise<void> | null = null;

  private async checkConnection(): Promise<void> {
    if (!this.promise) {
      this.promise = this.checkConnectionOnce();
    }
    return this.promise;
  }

  private async checkConnectionOnce(): Promise<void> {
    if (this.connected) {
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
