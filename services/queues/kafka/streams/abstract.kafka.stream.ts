import type { Consumer, EachMessagePayload } from "kafkajs";
import { filter, first, Subject } from "rxjs";

import { type AppLogger } from "../../../monitor/app.logger.ts";
import { topics } from "../index.ts";
import kafkaConnection from "../kafka.connection.ts";
import { KafkaDecodeConsumer } from "../kafka.interface.ts";

export abstract class AbstractKafkaStream extends KafkaDecodeConsumer {
  protected MAX_UNCOMMITED_MESSAGES = 1;
  protected fromTopicName: string;
  protected toTopicName: string | null;
  protected abstract fromTopic: keyof typeof topics;
  protected abstract toTopic: keyof typeof topics | null;
  private readonly subject: Subject<EachMessagePayload>;
  private consumer: Consumer;
  private unCommitted = 0;
  private unCommittedSubject = new Subject<number>();

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
    this.toTopicName = this.toTopic ? topics[this.toTopic].name : null;
  }

  public async start() {
    this.init();

    this.defineProcessingPipeline();

    await this.consume();
  }

  protected abstract defineProcessingPipeline(): void;

  protected throttleMaxUncommitedMessages(): Promise<void> {
    return new Promise((resolve) => {
      this.unCommittedSubject
        .pipe(
          filter((value) => {
            return value < this.MAX_UNCOMMITED_MESSAGES;
          }), // Emit only when unCommitted < 10
          first(), // Complete after the first valid emission
        )
        .subscribe(() => {
          resolve();
        });
    });
  }

  private increaseUncommitted() {
    const nextUncommitted = this.unCommitted + 1;

    this.unCommitted = nextUncommitted;
    this.unCommittedSubject.next(nextUncommitted);
  }

  protected decreaseUncommitted() {
    if (this.unCommitted === 0) {
      throw Error("Uncommitted is already zero.");
    }

    const nextUncommitted = this.unCommitted - 1;

    this.unCommitted = nextUncommitted;
    this.unCommittedSubject.next(nextUncommitted);
  }

  protected async consume(): Promise<void> {
    this.init();

    this.serviceLogger.info(
      `Started Consumer: ${this.consumerName} | Topic: ${this.fromTopicName}.`,
    );

    this.consumer = await kafkaConnection.consume({
      topic: this.fromTopicName,
      groupId: this.consumerName,
      eachMessageHandler: async (message: EachMessagePayload) => {
        if (this.unCommitted < this.MAX_UNCOMMITED_MESSAGES) {
          this.increaseUncommitted();
          this.subject.next(message);
          return;
        }
        await this.throttleMaxUncommitedMessages();
        this.subject.next(message);
        this.increaseUncommitted();
      },
      options: {
        autoCommit: false,
      },
    });
  }
}
