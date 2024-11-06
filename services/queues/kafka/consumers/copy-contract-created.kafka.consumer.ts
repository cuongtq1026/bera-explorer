import prisma from "@database/prisma.ts";
import { CopyContractCreatedProcessor } from "@processors/copy-contract-created.processor.ts";
import type { EachMessagePayload } from "kafkajs";
import type { Hash } from "viem";

import { KafkaReachedEndIndexedOffset } from "../../../exceptions/consumer.exception.ts";
import { appLogger } from "../../../monitor/app.logger.ts";
import { AbstractKafkaConsumer } from "./kafka.consumer.abstract.ts";

export class CopyContractCreatedKafkaConsumer extends AbstractKafkaConsumer {
  protected topic = "TRANSACTION" as const;
  protected consumerName = "copy-contract-created";

  constructor() {
    super({
      logger: appLogger.namespace(CopyContractCreatedKafkaConsumer.name),
    });
  }

  public async handler(eachMessagePayload: EachMessagePayload): Promise<void> {
    const rawDecodedContent =
      await this.getRawDecodedData<typeof this.topic>(eachMessagePayload);

    const hash = rawDecodedContent.hash as Hash;
    // process from db if already existed
    const dbTransaction = await prisma.transaction.findUnique({
      where: {
        hash,
      },
      include: {
        receipt: true,
      },
    });
    if (!dbTransaction || !dbTransaction.receipt) {
      throw new KafkaReachedEndIndexedOffset(
        eachMessagePayload.topic,
        this.consumerName,
        hash,
      );
    }

    const processor = new CopyContractCreatedProcessor();
    await processor.process(hash);

    await this.onFinish(eachMessagePayload, null);
  }
}
