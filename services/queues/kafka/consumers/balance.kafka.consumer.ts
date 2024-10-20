import { BalanceKafkaProcessor } from "@processors/balance.kafka.processor.ts";
import { plainToInstance } from "class-transformer";
import type { EachMessagePayload } from "kafkajs";
import type { Hash } from "viem";

import { PayloadNotFoundException } from "../../../exceptions/consumer.exception.ts";
import logger from "../../../monitor/logger.ts";
import { topics } from "../index.ts";
import kafkaConnection from "../kafka.connection.ts";
import { TransferMessagePayload } from "../producers/transfer.kafka.producer.ts";
import { AbstractKafkaConsumer } from "./kafka.consumer.abstract.ts";

export class BalanceKafkaConsumer extends AbstractKafkaConsumer {
  protected topicName = topics.TRANSFER.name;
  protected consumerName = "balance";

  constructor() {
    super();
  }

  protected async handler(
    eachMessagePayload: EachMessagePayload,
  ): Promise<void> {
    const messageId = `${this.consumerName}-${eachMessagePayload.topic}-${eachMessagePayload.partition}-${eachMessagePayload.message.offset}`;

    const rawContent = eachMessagePayload.message.value;
    if (!rawContent) {
      throw new PayloadNotFoundException(messageId);
    }
    logger.info(
      `[MessageId: ${messageId}] BalanceKafkaConsumer message rawContent size: ${rawContent.byteLength}.`,
    );

    const rawDecodedContent = await kafkaConnection.decode(rawContent);

    logger.info(
      `[MessageId: ${messageId}] BalanceKafkaConsumer message rawDecodedContent: ${rawDecodedContent.toString()}`,
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
