export abstract class AbstractConsumer<ConsumeReturn, MessagePayload> {
  abstract consume(): Promise<void>;

  protected abstract execute(
    eachMessagePayload: MessagePayload,
  ): Promise<ConsumeReturn>;

  protected abstract handler(
    eachMessagePayload: MessagePayload,
  ): Promise<ConsumeReturn>;
}
