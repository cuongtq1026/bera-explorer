import type { KafkaJS } from "@confluentinc/kafka-javascript";
import { BalanceKafkaProcessor } from "@processors/balance.kafka.processor.ts";
import { plainToInstance } from "class-transformer";
import type { Hash } from "viem";

import { PayloadNotFoundException } from "../../../exceptions/consumer.exception.ts";
import { appLogger } from "../../../monitor/app.logger.ts";
import kafkaConnection from "../kafka.connection.ts";
import { TransferMessagePayload } from "../producers";
import { AbstractKafkaConsumer } from "./kafka.consumer.abstract.ts";

const serviceLogger = appLogger.namespace("BalanceKafkaConsumer");

export class BalanceKafkaConsumer extends AbstractKafkaConsumer {
  protected topic = "TRANSFER" as const;
  protected consumerName = "balance";

  constructor() {
    super();
  }

  protected async handler(
    eachMessagePayload: KafkaJS.EachMessagePayload,
  ): Promise<void> {
    const messageId = `${this.consumerName}-${eachMessagePayload.topic}-${eachMessagePayload.partition}-${eachMessagePayload.message.offset}`;

    const rawContent = eachMessagePayload.message.value;
    if (!rawContent) {
      throw new PayloadNotFoundException(messageId);
    }
    serviceLogger.info(
      `[MessageId: ${messageId}] message rawContent size: ${rawContent.byteLength}.`,
    );

    const rawDecodedContent =
      await kafkaConnection.decode<typeof this.topic>(rawContent);

    serviceLogger.info(
      `[MessageId: ${messageId}] message rawDecodedContent: ${rawDecodedContent.toString()}`,
    );

    // transform
    const contentInstance = plainToInstance(
      TransferMessagePayload,
      JSON.parse(rawDecodedContent.toString()),
    );

    const { transferHash } = contentInstance;

    // process
    const processor = new BalanceKafkaProcessor();
    await processor.process(transferHash as Hash);
  }
}
