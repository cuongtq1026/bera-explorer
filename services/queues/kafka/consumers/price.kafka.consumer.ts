import { getSwap } from "@database/repositories/swap.repository.ts";
import { PriceProcessor } from "@processors/price.processor.ts";
import { plainToInstance } from "class-transformer";
import type { EachMessagePayload } from "kafkajs";

import {
  KafkaReachedEndIndexedOffset,
  PayloadNotFoundException,
} from "../../../exceptions/consumer.exception.ts";
import logger from "../../../monitor/logger.ts";
import { parseToBigInt } from "../../../utils.ts";
import kafkaConnection from "../kafka.connection.ts";
import { SwapMessagePayload } from "../producers/swap.kafka.producer.ts";
import { AbstractKafkaConsumer } from "./kafka.consumer.abstract.ts";

export class PriceKafkaConsumer extends AbstractKafkaConsumer {
  protected topic = "SWAP" as const;
  protected consumerName = "price";

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
      `[MessageId: ${messageId}] PriceKafkaConsumer message rawContent size: ${rawContent.byteLength}.`,
    );

    const rawDecodedContent =
      await kafkaConnection.decode<typeof this.topic>(rawContent);

    logger.info(
      `[MessageId: ${messageId}] PriceKafkaConsumer message rawDecodedContent: ${rawDecodedContent.toString()}`,
    );

    // transform
    const contentInstance = plainToInstance(
      SwapMessagePayload,
      JSON.parse(rawDecodedContent.toString()),
    );

    const { swapId: rawSwapId } = contentInstance;
    const swapId = parseToBigInt(rawSwapId);

    const swap = await getSwap(swapId);

    if (swap == null) {
      // TODO: Wait until data indexed
      throw new KafkaReachedEndIndexedOffset(
        eachMessagePayload.topic,
        this.consumerName,
        rawSwapId,
      );
    }

    const processor = new PriceProcessor();
    await processor.process(swapId);

    await this.onFinish(eachMessagePayload, null);
  }
}
