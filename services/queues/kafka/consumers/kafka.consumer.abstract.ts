import type { EachMessagePayload } from "kafkajs";

import { AppLogger } from "../../../monitor/app.logger.ts";
import type { IConsumer } from "../../consumer.interface.ts";
import { topics } from "../index.ts";
import kafkaConnection from "../kafka.connection.ts";
import { KafkaDecodeConsumer } from "../kafka.interface.ts";

export abstract class AbstractKafkaConsumer
  extends KafkaDecodeConsumer
  implements IConsumer<void, EachMessagePayload>
{
  private topicName: string;
  protected abstract topic: keyof typeof topics;
  protected abstract consumerName: string;
  /**
   * processOnMissing
   * false: throw exception KafkaReachedEndIndexedOffset and start retrying until the data is indexed from another service
   * true: it will process itself to fill in the missing data, no exception will be thrown
   *
   * NOTE: only TransferKafkaConsumer is supported for now
   * @protected
   */
  protected readonly processOnMissing: boolean =
    process.env.KAFKA_CONSUME_PROCESS_ON_NOT_INDEXED === "true";

  protected constructor(options: { logger: AppLogger }) {
    super(options);
  }

  private init() {
    this.topicName = topics[this.topic].name;
  }

  public async consume(): Promise<void> {
    this.init();

    this.serviceLogger.info(
      `Started Consumer: ${this.consumerName} | Topic: ${this.topicName}.`,
    );

    await kafkaConnection.consume({
      topic: this.topicName,
      groupId: this.consumerName,
      eachMessageHandler: (message: EachMessagePayload) =>
        this.execute(message),
    });
  }

  public async execute(eachMessagePayload: EachMessagePayload): Promise<void> {
    this.serviceLogger.info(`Handling message.`);
    await this.handler(eachMessagePayload);
    this.serviceLogger.info(`Handle message successfully.`);
  }

  public abstract handler(
    eachMessagePayload: EachMessagePayload,
  ): Promise<void>;

  public async onFinish(
    eachMessagePayload: EachMessagePayload,
    _data: any,
  ): Promise<void> {
    const messageId = `${this.consumerName}-${eachMessagePayload.topic}-${eachMessagePayload.partition}-${eachMessagePayload.message.offset}`;

    this.serviceLogger.info(`[MessageId: ${messageId}] Finished.`);
  }
}
