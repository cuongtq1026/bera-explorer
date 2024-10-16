import { findTransaction } from "@database/repositories/transaction.repository.ts";
import { SwapProcessor } from "@processors/swap.processor.ts";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import type { EachMessagePayload } from "kafkajs";
import type { Hash } from "viem";

import {
  InvalidPayloadException,
  KafkaReachedEndIndexedOffset,
  PayloadNotFoundException,
} from "../../../exceptions/consumer.exception.ts";
import logger from "../../../monitor/logger.ts";
import { topics, TransactionMessagePayload } from "../index.ts";
import { AbstractKafkaConsumer } from "./kafka.consumer.abstract.ts";

export class SwapKafkaConsumer extends AbstractKafkaConsumer {
  protected topicName = topics.TRANSACTION.name;
  protected consumerName = "swap";

  constructor() {
    super();
  }

  protected async handler(
    eachMessagePayload: EachMessagePayload,
  ): Promise<void> {
    const messageId = `${this.consumerName}-${eachMessagePayload.topic}-${eachMessagePayload.partition}-${eachMessagePayload.message.offset}`;

    const rawContent = eachMessagePayload.message.value?.toString();
    logger.info(
      `[MessageId: ${messageId}] SwapKafkaConsumer message rawContent: ${rawContent}.`,
    );

    if (!rawContent) {
      throw new PayloadNotFoundException(messageId);
    }

    // transform
    const contentInstance = plainToInstance(
      TransactionMessagePayload,
      JSON.parse(rawContent),
    );

    // validation
    const errors = await validate(contentInstance);
    if (errors.length > 0) {
      throw new InvalidPayloadException(messageId);
    }

    const { hash: transactionHash } = contentInstance;

    const transaction = await findTransaction(transactionHash as Hash, {
      withReceipt: true,
    });

    if (transaction == null || transaction.receipt == null) {
      // TODO: Wait until data indexed
      throw new KafkaReachedEndIndexedOffset(
        eachMessagePayload.topic,
        this.consumerName,
        transactionHash,
      );
    }

    const processor = new SwapProcessor();
    await processor.process(transaction.hash);
  }

  protected async onFinish(
    eachMessagePayload: EachMessagePayload,
    data: any,
  ): Promise<void> {
    return super.onFinish(eachMessagePayload, data);
  }
}
