import prisma from "@database/prisma.ts";
import { plainToInstance } from "class-transformer";
import type { EachMessagePayload } from "kafkajs";
import type { Hash } from "viem";

import { KafkaReachedEndIndexedOffset } from "../../../exceptions/consumer.exception.ts";
import { appLogger } from "../../../monitor/app.logger.ts";
import { TransactionMessagePayload } from "../producers";
import { sendToLogTopic } from "../producers/log.kafka.producer.ts";
import { AbstractKafkaConsumer } from "./kafka.consumer.abstract.ts";

export class LogKafkaConsumer extends AbstractKafkaConsumer {
  protected topic = "TRANSACTION" as const;
  protected consumerName = "log";

  constructor() {
    super({
      logger: appLogger.namespace(LogKafkaConsumer.name),
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

    const { hash } = contentInstance;
    // process from db if already existed
    const transactionDb = await prisma.transaction.findUnique({
      where: {
        hash,
      },
      include: {
        receipt: {
          select: {
            transactionHash: true,
            status: true,
            logs: {
              select: {
                logHash: true,
              },
              orderBy: [
                {
                  index: "asc",
                },
              ],
            },
          },
        },
      },
    });
    if (!transactionDb || !transactionDb.receipt) {
      // TODO: Wait until data indexed
      throw new KafkaReachedEndIndexedOffset(
        eachMessagePayload.topic,
        this.consumerName,
        hash,
      );
    }

    // ignore failed transaction
    if (!transactionDb.receipt.status) {
      await this.onFinish(eachMessagePayload, {
        transactionHash: hash,
        logs: [],
      });
      return;
    }

    await this.onFinish(eachMessagePayload, {
      transactionHash: hash,
      logs: transactionDb.receipt.logs.map((t) => t.logHash as Hash),
    });
  }

  public async onFinish(
    eachMessagePayload: EachMessagePayload,
    data: { transactionHash: string; logs: string[] },
  ): Promise<void> {
    const { logs } = data;

    if (!logs.length) {
      return super.onFinish(eachMessagePayload, data);
    }

    const messageId = `${this.consumerName}-${eachMessagePayload.topic}-${eachMessagePayload.partition}-${eachMessagePayload.message.offset}`;

    // Send to log topic
    await sendToLogTopic(
      logs.map((log) => ({
        logHash: log,
      })),
    );
    this.serviceLogger.info(
      `[MessageId: ${messageId}] Sent ${logs.length} messages to log topic.`,
    );
    return super.onFinish(eachMessagePayload, data);
  }
}
