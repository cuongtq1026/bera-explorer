import { BalanceKafkaProcessor } from "@processors/balance.kafka.processor.ts";
import { plainToInstance } from "class-transformer";
import type { EachMessagePayload } from "kafkajs";
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

  public async handler(eachMessagePayload: EachMessagePayload): Promise<void> {
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
