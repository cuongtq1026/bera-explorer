import type { KafkaJS } from "@confluentinc/kafka-javascript";

import { appLogger } from "../../../monitor/app.logger.ts";
import { AbstractConsumer } from "../../consumer.abstract.ts";
import { topics } from "../index.ts";
import kafkaConnection from "../kafka.connection.ts";

const serviceLogger = appLogger.namespace("AbstractKafkaConsumer");

export abstract class AbstractKafkaConsumer extends AbstractConsumer<
  void,
  KafkaJS.EachMessagePayload
> {
  protected abstract topic: keyof typeof topics;
  private topicName: string;
  protected abstract consumerName: string;

  protected constructor() {
    super();
  }

  private init() {
    this.topicName = topics[this.topic].name;
  }

  public async consume(): Promise<void> {
    this.init();

    serviceLogger.info(
      `Started Consumer: ${this.consumerName} | Topic: ${this.topicName}.`,
    );

    await kafkaConnection.consume({
      topic: this.topicName,
      groupId: this.consumerName,
      eachMessageHandler: (message: KafkaJS.EachMessagePayload) =>
        this.execute(message),
    });
  }

  protected async execute(
    eachMessagePayload: KafkaJS.EachMessagePayload,
  ): Promise<void> {
    serviceLogger.info(`Handling message.`);
    await this.handler(eachMessagePayload);
    serviceLogger.info(`Handle message successfully.`);
  }

  protected abstract handler(
    eachMessagePayload: KafkaJS.EachMessagePayload,
  ): Promise<void>;

  protected async onFinish(
    eachMessagePayload: KafkaJS.EachMessagePayload,
    _data: any,
  ): Promise<void> {
    const messageId = `${this.consumerName}-${eachMessagePayload.topic}-${eachMessagePayload.partition}-${eachMessagePayload.message.offset}`;

    serviceLogger.info(`[MessageId: ${messageId}] Finished.`);
  }
}
