import type { KafkaJS } from "@confluentinc/kafka-javascript";
import { Subject } from "rxjs";

import { type AppLogger } from "../../../monitor/app.logger.ts";
import { topics } from "../index.ts";
import kafkaConnection from "../kafka.connection.ts";
import { KafkaDecodeConsumer } from "../kafka.interface.ts";

export abstract class AbstractKafkaStream extends KafkaDecodeConsumer {
  protected fromTopicName: string;
  protected toTopicName: string;
  protected abstract fromTopic: keyof typeof topics;
  protected abstract toTopic: keyof typeof topics;
  private readonly subject: Subject<KafkaJS.EachMessagePayload>;
  private consumer: KafkaJS.Consumer;

  constructor(options: { logger: AppLogger }) {
    super(options);

    this.subject = new Subject();
  }

  protected getSubject() {
    return this.subject;
  }

  protected getConsumer() {
    return this.consumer;
  }

  protected init() {
    this.fromTopicName = topics[this.fromTopic].name;
    this.toTopicName = topics[this.toTopic].name;
  }

  public async start() {
    this.init();

    this.defineProcessingPipeline();

    await this.consume();
  }

  protected abstract defineProcessingPipeline(): void;

  protected async consume(): Promise<void> {
    this.init();

    this.serviceLogger.info(
      `Started Consumer: ${this.consumerName} | Topic: ${this.fromTopicName}.`,
    );

    this.consumer = await kafkaConnection.consume({
      topic: this.fromTopicName,
      groupId: this.consumerName,
      eachMessageHandler: async (message: KafkaJS.EachMessagePayload) => {
        this.subject.next(message);
      },
      options: {
        autoCommit: false,
      },
    });
  }
}
