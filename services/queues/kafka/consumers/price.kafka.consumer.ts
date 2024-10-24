import type { KafkaJS } from "@confluentinc/kafka-javascript";
import { getSwap } from "@database/repositories/swap.repository.ts";
import { PriceProcessor } from "@processors/price.processor.ts";
import { plainToInstance } from "class-transformer";

import { KafkaReachedEndIndexedOffset } from "../../../exceptions/consumer.exception.ts";
import { appLogger } from "../../../monitor/app.logger.ts";
import { parseToBigInt } from "../../../utils.ts";
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

  protected async handler(
    eachMessagePayload: KafkaJS.EachMessagePayload,
  ): Promise<void> {
    const rawDecodedContent =
      await this.getRawDecodedData<typeof this.topic>(eachMessagePayload);

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
