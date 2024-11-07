import { findTransaction } from "@database/repositories/transaction.repository.ts";
import { SwapProcessor } from "@processors/swap.processor.ts";
import { plainToInstance } from "class-transformer";
import type { EachMessagePayload } from "kafkajs";
import type { Hash } from "viem";

import { KafkaReachedEndIndexedOffset } from "../../../exceptions/consumer.exception.ts";
import { appLogger } from "../../../monitor/app.logger.ts";
import { TransactionMessagePayload } from "../producers";
import { sendToSwapTopic } from "../producers/swap.kafka.producer.ts";
import { AbstractKafkaConsumer } from "./kafka.consumer.abstract.ts";

export class SwapKafkaConsumer extends AbstractKafkaConsumer {
  protected topic = "TRANSACTION" as const;
  protected consumerName = "swap";

  constructor() {
    super({
      logger: appLogger.namespace(SwapKafkaConsumer.name),
    });
  }

  public async handler(eachMessagePayload: EachMessagePayload): Promise<void> {
    const rawDecodedContent =
      await this.getRawDecodedData<typeof this.topic>(eachMessagePayload);

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

    // ignore failed transaction
    if (!transaction.receipt.status) {
      await this.onFinish(eachMessagePayload, { swapHashes: null });
      return;
    }

    const processor = new SwapProcessor();
    const swapHashes = await processor.process(transaction.hash);

    await this.onFinish(eachMessagePayload, { swapHashes });
  }

  public async onFinish(
    eachMessagePayload: EachMessagePayload,
    data: {
      swapHashes: string[] | null;
    },
  ): Promise<void> {
    const { swapHashes } = data;

    if (!swapHashes) {
      return super.onFinish(eachMessagePayload, data);
    }
    const messageId = `${this.consumerName}-${eachMessagePayload.topic}-${eachMessagePayload.partition}-${eachMessagePayload.message.offset}`;

    // Send to swap topic
    await sendToSwapTopic(
      swapHashes.map((swapHash) => ({
        swapHash: swapHash.toString(),
      })),
    );
    this.serviceLogger.info(
      `[MessageId: ${messageId}] Sent ${swapHashes.length} messages to swap topic.`,
    );

    return super.onFinish(eachMessagePayload, data);
  }
}
