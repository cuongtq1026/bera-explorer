import type { EachMessagePayload } from "kafkajs";

import { PayloadNotFoundException } from "../../exceptions/consumer.exception.ts";
import type { AppLogger } from "../../monitor/app.logger.ts";
import { topics } from "./index.ts";
import { AbstractInjectLogger } from "./inject-logger.abstract.ts";
import kafkaConnection from "./kafka.connection.ts";

export abstract class KafkaDecodeConsumer extends AbstractInjectLogger {
  protected abstract consumerName: string;

  protected constructor(options: { logger: AppLogger }) {
    super(options);
  }

  protected async getRawDecodedData<T extends keyof typeof topics>(
    eachMessagePayload: EachMessagePayload,
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
}
