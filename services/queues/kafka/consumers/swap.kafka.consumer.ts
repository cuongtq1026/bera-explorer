import { findTransaction } from "@database/repositories/transaction.repository.ts";
import { SwapProcessor } from "@processors/swap.processor.ts";
import { plainToInstance } from "class-transformer";
import type { EachMessagePayload } from "kafkajs";
import type { Hash } from "viem";

import {
  KafkaReachedEndIndexedOffset,
  PayloadNotFoundException,
} from "../../../exceptions/consumer.exception.ts";
import logger from "../../../monitor/logger.ts";
import { topics, TransactionMessagePayload } from "../index.ts";
import kafkaConnection from "../kafka.connection.ts";
import { sendToSwapTopic } from "../producers";
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

    const rawContent = eachMessagePayload.message.value;
    if (!rawContent) {
      throw new PayloadNotFoundException(messageId);
    }
    logger.info(
      `[MessageId: ${messageId}] SwapKafkaConsumer message rawContent size: ${rawContent.byteLength}.`,
    );

    const rawDecodedContent = await kafkaConnection.decode(rawContent);

    logger.info(
      `[MessageId: ${messageId}] SwapKafkaConsumer message rawDecodedContent: ${rawDecodedContent.toString()}`,
    );

    // transform
    const contentInstance = plainToInstance(
      TransactionMessagePayload,
      JSON.parse(rawDecodedContent.toString()),
    );

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
    const swapIds = await processor.process(transaction.hash);

    await this.onFinish(eachMessagePayload, { swapIds });
  }

  protected async onFinish(
    eachMessagePayload: EachMessagePayload,
    data: {
      swapIds: (bigint | number)[] | null;
    },
  ): Promise<void> {
    const { swapIds } = data;

    if (!swapIds) {
      return super.onFinish(eachMessagePayload, data);
    }
    const messageId = `${this.consumerName}-${eachMessagePayload.topic}-${eachMessagePayload.partition}-${eachMessagePayload.message.offset}`;

    // Send to swap topic
    await sendToSwapTopic(
      swapIds.map((swapId) => ({
        swapId: swapId.toString(),
      })),
    );
    logger.info(
      `[MessageId: ${messageId}] Sent ${swapIds.length} messages to swap topic.`,
    );

    return super.onFinish(eachMessagePayload, data);
  }
}
