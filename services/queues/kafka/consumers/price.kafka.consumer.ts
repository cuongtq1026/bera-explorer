import { getSwap } from "@database/repositories/swap.repository.ts";
import { PriceProcessor } from "@processors/price/price.processor.ts";
import { plainToInstance } from "class-transformer";
import type { EachMessagePayload } from "kafkajs";

import { KafkaReachedEndIndexedOffset } from "../../../exceptions/consumer.exception.ts";
import { appLogger } from "../../../monitor/app.logger.ts";
import { SwapMessagePayload } from "../producers";
import { AbstractKafkaConsumer } from "./kafka.consumer.abstract.ts";

export class PriceKafkaConsumer extends AbstractKafkaConsumer {
  protected topic = "SWAP" as const;
  protected consumerName = "price";

  constructor() {
    super({
      logger: appLogger.namespace(PriceKafkaConsumer.name),
    });
  }

  public async handler(eachMessagePayload: EachMessagePayload): Promise<void> {
    const rawDecodedContent =
      await this.getRawDecodedData<typeof this.topic>(eachMessagePayload);

    // transform
    const contentInstance = plainToInstance(
      SwapMessagePayload,
      JSON.parse(rawDecodedContent.toString()),
    );

    const { swapHash } = contentInstance;

    const swap = await getSwap(swapHash);

    if (swap == null) {
      // TODO: Wait until data indexed
      throw new KafkaReachedEndIndexedOffset(
        eachMessagePayload.topic,
        this.consumerName,
        swapHash,
      );
    }

    const processor = new PriceProcessor();
    await processor.process(swapHash);

    await this.onFinish(eachMessagePayload, null);
  }
}
