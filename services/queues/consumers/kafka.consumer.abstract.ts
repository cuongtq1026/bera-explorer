import { AbstractConsumer } from "@consumers/consumer.abstract.ts";
import type { EachMessagePayload } from "kafkajs";

import logger from "../../monitor/logger.ts";
import kafkaConnection from "../kafka/kafka.connection.ts";

export abstract class AbstractKafkaConsumer extends AbstractConsumer<
  void,
  EachMessagePayload
> {
  protected abstract topicName: string;

  protected constructor() {
    super();
  }

  public async consume(): Promise<void> {
    logger.info(`Consumer topic ${this.topicName} started.`);

    await kafkaConnection.consume(
      this.topicName,
      (message: EachMessagePayload) => this.execute(message),
    );
  }

  protected async execute(
    eachMessagePayload: EachMessagePayload,
  ): Promise<void> {
    logger.info(`Handling message.`);
    await this.handler(eachMessagePayload);
    logger.info(`Handle message successfully.`);
  }

  protected abstract handler(
    eachMessagePayload: EachMessagePayload,
  ): Promise<void>;
}
