import { getSwap } from "@database/repositories/swap.repository.ts";
import { PriceProcessor } from "@processors/price.processor.ts";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import type { EachMessagePayload } from "kafkajs";

import {
  InvalidPayloadException,
  KafkaReachedEndIndexedOffset,
  PayloadNotFoundException,
} from "../../../exceptions/consumer.exception.ts";
import logger from "../../../monitor/logger.ts";
import { parseToBigInt } from "../../../utils.ts";
import { SwapMessagePayload, topics } from "../index.ts";
import { AbstractKafkaConsumer } from "./kafka.consumer.abstract.ts";

export class PriceKafkaConsumer extends AbstractKafkaConsumer {
  protected topicName = topics.SWAP.name;
  protected consumerName = "price";

  constructor() {
    super();
  }

  protected async handler(
    eachMessagePayload: EachMessagePayload,
  ): Promise<void> {
    const messageId = `${this.consumerName}-${eachMessagePayload.topic}-${eachMessagePayload.partition}-${eachMessagePayload.message.offset}`;

    const rawContent = eachMessagePayload.message.value?.toString();
    logger.info(
      `[MessageId: ${messageId}] PriceKafkaConsumer message rawContent: ${rawContent}.`,
    );

    if (!rawContent) {
      throw new PayloadNotFoundException(messageId);
    }

    // transform
    const contentInstance = plainToInstance(
      SwapMessagePayload,
      JSON.parse(rawContent),
    );

    // validation
    const errors = await validate(contentInstance);
    if (errors.length > 0) {
      throw new InvalidPayloadException(messageId);
    }

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
