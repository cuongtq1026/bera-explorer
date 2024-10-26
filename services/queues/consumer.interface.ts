export interface IConsumer<ConsumeReturn, MessagePayload> {
  consume(): Promise<void>;

  execute(eachMessagePayload: MessagePayload): Promise<ConsumeReturn>;

  handler(eachMessagePayload: MessagePayload): Promise<ConsumeReturn>;
}
