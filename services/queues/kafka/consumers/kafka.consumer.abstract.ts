import type { KafkaJS } from "@confluentinc/kafka-javascript";

import { PayloadNotFoundException } from "../../../exceptions/consumer.exception.ts";
import { AppLogger } from "../../../monitor/app.logger.ts";
import { AbstractConsumer } from "../../consumer.abstract.ts";
import { topics } from "../index.ts";
import kafkaConnection from "../kafka.connection.ts";

export abstract class AbstractKafkaConsumer extends AbstractConsumer<
  void,
  KafkaJS.EachMessagePayload
> {
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
      eachMessageHandler: (message: KafkaJS.EachMessagePayload) =>
        this.execute(message),
    });
  }

  protected async getRawDecodedData<T extends keyof typeof topics>(
    eachMessagePayload: KafkaJS.EachMessagePayload,
  ): Promise<ReturnType<typeof kafkaConnection.decode<T>>> {
    const messageId = `${this.consumerName}-${eachMessagePayload.topic}-${eachMessagePayload.partition}-${eachMessagePayload.message.offset}`;

    const rawContent = eachMessagePayload.message.value;
    if (!rawContent) {
      throw new PayloadNotFoundException(this.consumerName, messageId);
    }
    this.serviceLogger.info(
      `[MessageId: ${messageId}] message rawContent size: ${rawContent.byteLength} bytes.`,
    );

    const rawDecodedContent = await kafkaConnection.decode<T>(rawContent);

    this.serviceLogger.info(
      `[MessageId: ${messageId}] message rawDecodedContent: ${rawDecodedContent.toString()}`,
    );

    return rawDecodedContent;
  }

  protected async execute(
    eachMessagePayload: KafkaJS.EachMessagePayload,
  ): Promise<void> {
    this.serviceLogger.info(`Handling message.`);
    await this.handler(eachMessagePayload);
    this.serviceLogger.info(`Handle message successfully.`);
  }

  protected abstract handler(
    eachMessagePayload: KafkaJS.EachMessagePayload,
  ): Promise<void>;

  protected async onFinish(
    eachMessagePayload: KafkaJS.EachMessagePayload,
    _data: any,
  ): Promise<void> {
    const messageId = `${this.consumerName}-${eachMessagePayload.topic}-${eachMessagePayload.partition}-${eachMessagePayload.message.offset}`;

    this.serviceLogger.info(`[MessageId: ${messageId}] Finished.`);
  }
}
