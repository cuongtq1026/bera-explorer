import type { KafkaJS } from "@confluentinc/kafka-javascript";
import { isERC20TransferLog } from "@database/dto.ts";
import prisma from "@database/prisma.ts";
import { TransferProcessor } from "@processors/transfer.processor.ts";
import { plainToInstance } from "class-transformer";
import type { Hash } from "viem";

import { KafkaReachedEndIndexedOffset } from "../../../exceptions/consumer.exception.ts";
import { appLogger } from "../../../monitor/app.logger.ts";
import { LogMessagePayload } from "../producers";
import { sendToTransferTopic } from "../producers/transfer.kafka.producer.ts";
import { AbstractKafkaConsumer } from "./kafka.consumer.abstract.ts";

/**
 * Steps:
 * - Get log from database, if it is not found, stop consumer and wait until it is indexed
 * - Check signature of log's topics, if it is not ERC20 Transfer, finish
 * - Check log.transfer, if it is not found, stop consumer and wait until it is indexed
 * - Send transfer to transfer topic
 */
export class TransferKafkaConsumer extends AbstractKafkaConsumer {
  protected topic = "LOG" as const;
  protected consumerName = "transfer";

  constructor() {
    super({
      logger: appLogger.namespace(TransferKafkaConsumer.name),
    });
  }

  public async handler(
    eachMessagePayload: KafkaJS.EachMessagePayload,
  ): Promise<void> {
    const rawDecodedContent =
      await this.getRawDecodedData<typeof this.topic>(eachMessagePayload);

    // transform
    const contentInstance = plainToInstance(
      LogMessagePayload,
      JSON.parse(rawDecodedContent.toString()),
    );

    const { logHash } = contentInstance;

    // process from db if already existed
    const logDb = await prisma.log.findUnique({
      where: {
        logHash,
      },
      include: {
        transfer: {
          select: {
            hash: true,
          },
        },
        topics: {
          select: {
            topic: true,
          },
        },
      },
    });

    if (logDb == null) {
      // TODO: Wait until data indexed
      throw new KafkaReachedEndIndexedOffset(
        eachMessagePayload.topic,
        this.consumerName,
        logHash,
      );
    }
    {
      if (!isERC20TransferLog(logDb.topics)) {
        await this.onFinish(eachMessagePayload, {
          transferHash: null,
        });
        return;
      }
    }

    if (!logDb.transfer) {
      if (!this.processOnMissing) {
        // TODO: Wait until data indexed
        throw new KafkaReachedEndIndexedOffset(
          eachMessagePayload.topic,
          this.consumerName,
          logHash,
        );
      }

      const processor = new TransferProcessor();
      const hashes = await processor.process(logDb.transactionHash as Hash);
      const transfer = hashes.find((h) => h.hash == logHash);
      if (!transfer) {
        throw Error(`LogHash: ${logHash}. Transfer is not found`);
      }
      await this.onFinish(eachMessagePayload, {
        transferHash: transfer.hash,
      });
      return;
    }

    await this.onFinish(eachMessagePayload, {
      transferHash: logDb.transfer.hash,
    });
    return;
  }

  public async onFinish(
    eachMessagePayload: KafkaJS.EachMessagePayload,
    data: { transferHash: string | null },
  ): Promise<void> {
    const { transferHash } = data;

    if (!transferHash) {
      return super.onFinish(eachMessagePayload, data);
    }

    const messageId = `${this.consumerName}-${eachMessagePayload.topic}-${eachMessagePayload.partition}-${eachMessagePayload.message.offset}`;

    // Send to log topic
    await sendToTransferTopic([
      {
        transferHash,
      },
    ]);
    this.serviceLogger.info(
      `[MessageId: ${messageId}] Sent ${transferHash} message to transfer topic.`,
    );
    return super.onFinish(eachMessagePayload, data);
  }
}
