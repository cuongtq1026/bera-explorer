import type { KafkaJS } from "@confluentinc/kafka-javascript";
import { BalanceKafkaProcessor } from "@processors/balance.kafka.processor.ts";
import { plainToInstance } from "class-transformer";
import type { Hash } from "viem";

import { appLogger } from "../../../monitor/app.logger.ts";
import { TransferMessagePayload } from "../producers";
import { AbstractKafkaConsumer } from "./kafka.consumer.abstract.ts";

export class BalanceKafkaConsumer extends AbstractKafkaConsumer {
  protected topic = "TRANSFER" as const;
  protected consumerName = "balance";

  constructor() {
    super({
      logger: appLogger.namespace(BalanceKafkaConsumer.name),
    });
  }

  protected async handler(
    eachMessagePayload: KafkaJS.EachMessagePayload,
  ): Promise<void> {
    const rawDecodedContent =
      await this.getRawDecodedData<typeof this.topic>(eachMessagePayload);

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
