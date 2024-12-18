import { AbstractConnectable } from "@interfaces/connectable.abstract.ts";
import { SchemaRegistry, SchemaType } from "@kafkajs/confluent-schema-registry";
import {
  type Admin,
  type Consumer,
  type EachMessageHandler,
  type EachMessagePayload,
  Kafka,
  type LogEntry,
  logLevel,
  type Message,
  type Producer,
  type Transaction,
} from "kafkajs";
import { Subject } from "rxjs";

import { appLogger, getLevelByNumber } from "../../monitor/app.logger.ts";
import { topics } from "./index.ts";
import {
  type BlockMessagePayload,
  CopyTradeMessagePayload,
  type LogMessagePayload,
  type PriceMessagePayload,
  type SwapMessagePayload,
  type TransactionMessagePayload,
  type TransferMessagePayload,
} from "./producers";
import {
  blockSchema,
  copyTradeLogSchema,
  logSchema,
  priceSchema,
  swapSchema,
  transactionSchema,
  transferSchema,
} from "./schemas";

export type TransactionOptions = {
  transaction?: Transaction;
};

export class KafkaConnection extends AbstractConnectable {
  private connection: Kafka;
  private producer!: Producer;
  private producerEOS!: Producer;
  private admin!: Admin;
  private registry!: SchemaRegistry;
  private schemaMap = new Map<keyof typeof topics, number>();

  constructor() {
    super({
      logger: appLogger.namespace(KafkaConnection.name),
    });
  }

  async connect() {
    if (this.connected && this.producer) return;

    const kafkaBrokerUrl = process.env.KAFKA_BROKER_CONNECTION;
    if (!kafkaBrokerUrl) {
      throw Error("No Kafka connection URL provided");
    }
    const schemaRegistry = process.env.SCHEMA_REGISTRY;
    if (!schemaRegistry) {
      throw Error("No schema registry connection URL provided");
    }

    try {
      this.connection = new Kafka({
        clientId: "bera-explorer",
        brokers: [kafkaBrokerUrl],
        logLevel: logLevel.INFO,
        logCreator: () => {
          return (entry: LogEntry) => {
            const kafkaLogger = appLogger.namespace(entry.namespace, {
              level: entry.level,
            });

            kafkaLogger.log({
              level: getLevelByNumber(entry.level),
              ...entry.log,
            });
          };
        },
      });

      // initiate producer connection
      {
        this.serviceLogger.info(`⌛  Connecting to Kafka Producer`);
        this.producer = this.connection.producer();
        this.producerEOS = this.connection.producer({
          idempotent: true,
          transactionalId: "transactional-producer",
          maxInFlightRequests: 1,
        });
        await this.producer.connect();
        await this.producerEOS.connect();
        this.serviceLogger.info(`✅  Kafka Producer is ready`);
      }

      // initiate admin connection
      {
        this.serviceLogger.info(`⌛  Connecting to Kafka Admin`);
        this.admin = this.connection.admin();
        await this.admin.connect();
        this.serviceLogger.info(`✅  Kafka Admin is ready`);
      }

      // initiate topics
      {
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
        this.serviceLogger.info(`Kafka topics created`);
      }

      // initiate schema registry connection
      {
        this.serviceLogger.info(`⌛  Connecting to Schema Registry`);
        this.registry = new SchemaRegistry({ host: schemaRegistry });
        this.serviceLogger.info(`✅  Schema Registry is ready`);
      }

      // initiate schemas
      {
        this.serviceLogger.info(`⌛  Creating Registry schemas`);

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
        this.schemaMap.set("INDEXED_TRANSACTION", transactionSchemaId);

        const { id: transferSchemaId } = await this.registry.register({
          type: SchemaType.AVRO,
          schema: JSON.stringify(transferSchema),
        });
        this.schemaMap.set("TRANSFER", transferSchemaId);
        const { id: priceSchemaId } = await this.registry.register({
          type: SchemaType.AVRO,
          schema: JSON.stringify(priceSchema),
        });
        this.schemaMap.set("PRICE", priceSchemaId);
        const { id: copyTradeLogSchemaId } = await this.registry.register({
          type: SchemaType.AVRO,
          schema: JSON.stringify(copyTradeLogSchema),
        });
        this.schemaMap.set("COPY_TRADE_LOG", copyTradeLogSchemaId);

        this.serviceLogger.info(
          `✅  Schema Registry registered: ${this.schemaMap.size}`,
        );
      }

      // When everything is fully connected, set connected = true
      this.connected = true;
    } catch (error: any) {
      this.serviceLogger.error(`Failed to connect to Kafka`);

      throw error;
    }
  }

  public async encode<T extends keyof typeof topics>(
    schemaName: T,
    value: Awaited<ReturnType<typeof this.decode<T>>>,
  ): Promise<Buffer> {
    await this.checkConnection();

    return this.registry.encode(this.getSchemaId(schemaName), value);
  }

  public async decode<T extends keyof typeof topics>(
    value: Buffer,
  ): Promise<
    T extends "BLOCK"
      ? BlockMessagePayload
      : T extends "TRANSACTION" | "INDEXED_TRANSACTION"
        ? TransactionMessagePayload
        : T extends "LOG"
          ? LogMessagePayload
          : T extends "TRANSFER"
            ? TransferMessagePayload
            : T extends "SWAP"
              ? SwapMessagePayload
              : T extends "PRICE"
                ? PriceMessagePayload
                : T extends "COPY_TRADE_LOG"
                  ? CopyTradeMessagePayload
                  : never
  > {
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

  public async transaction(): Promise<Transaction> {
    await this.checkConnection();

    return this.producerEOS.transaction();
  }

  public async send<T extends Message = Message>(
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
    options,
  }: {
    topic: string;
    groupId: string;
    eachMessageHandler: EachMessageHandler;
    options?: {
      autoCommit: boolean;
    };
  }): Promise<Consumer> {
    await this.checkConnection();

    const envGroupId = process.env.KAFKA_GROUP_ID;
    if (!envGroupId) {
      throw new Error(`Missing KAFKA_GROUP_ID`);
    }
    const groupIdTopic = [envGroupId, groupId, topic].join("-");

    const { autoCommit = true } = options ?? {};
    const consumer = this.connection.consumer({
      groupId: groupIdTopic,
    });

    this.serviceLogger.info(`⌛  Connecting to Consumer ${groupIdTopic}`);
    await consumer.connect();
    this.serviceLogger.info(`✅  Connected to Consumer ${groupIdTopic}`);

    await consumer.subscribe({
      topics: [topic],
      fromBeginning: true,
    });

    await consumer.run({
      eachMessage: eachMessageHandler,
      autoCommit,
      autoCommitInterval: 1000,
    });

    return consumer;
  }

  public async consumeLatestMessage<T extends keyof typeof topics>(
    topicKey: T,
  ): ReturnType<typeof this.decode<T>> {
    await this.checkConnection();

    const subject = new Subject<EachMessagePayload>();
    const topicName = topics[topicKey].name;
    const envGroupId = process.env.KAFKA_GROUP_ID;
    if (!envGroupId) {
      throw new Error(`Missing KAFKA_GROUP_ID`);
    }
    const groupId = "latest";
    const groupIdTopic = [envGroupId, groupId, topicName].join("-");

    const consumer = this.connection.consumer({
      groupId: groupIdTopic,
    });

    const topicOffsets = await this.admin.fetchTopicOffsets(topicName);

    // Get the latest offset
    const latestPartitionOffsets = topicOffsets
      .map((partitionOffset) => ({
        partition: partitionOffset.partition,
        offset: (parseInt(partitionOffset.offset) - 2).toString(), // Offset -1 for the last message
      }))
      .sort((a, b) => parseInt(a.offset) - parseInt(b.offset));
    const latestPartitionOffset = latestPartitionOffsets[0];

    this.serviceLogger.info(`⌛  Connecting to Consumer ${groupIdTopic}`);
    await consumer.connect();
    this.serviceLogger.info(`✅  Connected to Consumer ${groupIdTopic}`);

    await consumer.subscribe({
      topics: [topicName],
      fromBeginning: true,
    });

    await consumer.run({
      eachMessage: async (eachMessagePayload): Promise<void> => {
        eachMessagePayload.pause();
        subject.next(eachMessagePayload);
      },
    });

    consumer.seek({
      topic: topicName,
      partition: latestPartitionOffset.partition,
      offset: latestPartitionOffset.offset,
    });

    const lastMessage = await new Promise<Buffer>((resolve) => {
      subject.asObservable().subscribe({
        next: (eachMessagePayload) => {
          consumer.disconnect().then(() => {
            if (!eachMessagePayload.message.value) {
              throw new Error(`Missing message value`);
            }
            resolve(eachMessagePayload.message.value);
          });
        },
      });
    });

    return this.decode<T>(lastMessage);
  }
}

const kafkaConnection = new KafkaConnection();

export default kafkaConnection;
