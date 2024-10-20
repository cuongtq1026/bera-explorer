import { KafkaJS } from "@confluentinc/kafka-javascript";
import { SchemaRegistry, SchemaType } from "@kafkajs/confluent-schema-registry";

import { appLogger } from "../../monitor/app.logger.ts";
import { KafkaLogger } from "../../monitor/kafka.logger.ts";
import { topics } from "./index.ts";
import {
  blockSchema,
  logSchema,
  swapSchema,
  transactionSchema,
  transferSchema,
} from "./schemas";

const serviceLogger = appLogger.namespace("KafkaConnection");

export type TransactionOptions = {
  transaction?: KafkaJS.Transaction;
};

export class KafkaConnection {
  private connection: KafkaJS.Kafka;
  private connected!: boolean;
  private producer!: KafkaJS.Producer;
  private producerEOS!: KafkaJS.Producer;
  private admin!: KafkaJS.Admin;
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
      this.connection = new KafkaJS.Kafka({
        kafkaJS: {
          clientId: "bera-explorer",
          brokers: [kafkaBrokerUrl],
          logger: new KafkaLogger(),
        },
      });

      this.producer = this.connection.producer();
      this.producerEOS = this.connection.producer({
        kafkaJS: {
          idempotent: true,
          transactionalId: "transactional-producer",
          maxInFlightRequests: 1,
        },
      });

      serviceLogger.info(`⌛  Connecting to Kafka Producer`);
      await this.producer.connect();
      await this.producerEOS.connect();
      serviceLogger.info(`✅  Kafka Producer is ready`);

      this.admin = this.connection.admin();
      serviceLogger.info(`⌛  Connecting to Kafka Admin`);
      await this.admin.connect();
      serviceLogger.info(`✅  Kafka Admin is ready`);
      serviceLogger.info(`⌛  Connecting to Schema Registry`);
      this.registry = new SchemaRegistry({ host: schemaRegistry });
      serviceLogger.info(`✅  Schema Registry is ready`);
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
      serviceLogger.info(`Kafka topics created`);

      {
        serviceLogger.info(`⌛  Creating Registry schemas`);

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

        serviceLogger.info(
          `✅  Schema Registry registered: ${this.schemaMap.size}`,
        );
      }

      // When everything is fully connected, set connected = true
      this.connected = true;
    } catch (error: any) {
      serviceLogger.error(`Failed to connect to Kafka`);

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

  public async transaction(): Promise<KafkaJS.Transaction> {
    await this.checkConnection();

    return this.producerEOS.transaction();
  }

  public async send<T extends KafkaJS.Message = KafkaJS.Message>(
    topic: string,
    messages: T[],
    options?: TransactionOptions,
  ) {
    await this.checkConnection();

    const { transaction } = options ?? {};
    if (transaction) {
      await transaction.send({
        topic: topic,
        messages: messages,
      });
      return;
    }

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
    eachMessageHandler: KafkaJS.EachMessageHandler;
  }) {
    await this.checkConnection();

    const envGroupId = process.env.KAFKA_GROUP_ID;
    if (!envGroupId) {
      throw new Error(`Missing KAFKA_GROUP_ID`);
    }
    const groupIdTopic = [envGroupId, groupId, topic].join("-");
    const consumer = this.connection.consumer({
      kafkaJS: {
        groupId: groupIdTopic,
        fromBeginning: true,
        autoCommit: true,
        autoCommitInterval: 1000,
      },
    });

    serviceLogger.info(`⌛  Connecting to Consumer ${groupIdTopic}`);
    await consumer.connect();
    serviceLogger.info(`✅  Connected to Consumer ${groupIdTopic}`);

    await consumer.subscribe({
      topics: [topic],
    });

    await consumer.run({
      eachMessage: eachMessageHandler,
    });
  }
}

const kafkaConnection = new KafkaConnection();

export default kafkaConnection;
