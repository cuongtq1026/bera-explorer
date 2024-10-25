import { AppLogger } from "../monitor/app.logger.ts";

export abstract class AbstractConsumer<ConsumeReturn, MessagePayload> {
  protected readonly serviceLogger: AppLogger;

  protected constructor(options: { logger: AppLogger }) {
    this.serviceLogger = options.logger;
  }

  abstract consume(): Promise<void>;

  protected abstract execute(
    eachMessagePayload: MessagePayload,
  ): Promise<ConsumeReturn>;

  protected abstract handler(
    eachMessagePayload: MessagePayload,
  ): Promise<ConsumeReturn>;
}
