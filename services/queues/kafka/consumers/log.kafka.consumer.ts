import type { KafkaJS } from "@confluentinc/kafka-javascript/";
import prisma from "@database/prisma.ts";
import { plainToInstance } from "class-transformer";
import type { Hash } from "viem";

import {
  KafkaReachedEndIndexedOffset,
  PayloadNotFoundException,
} from "../../../exceptions/consumer.exception.ts";
import { appLogger } from "../../../monitor/app.logger.ts";
import kafkaConnection from "../kafka.connection.ts";
import { TransactionMessagePayload } from "../producers";
import { sendToLogTopic } from "../producers/log.kafka.producer.ts";
import { AbstractKafkaConsumer } from "./kafka.consumer.abstract.ts";

const serviceLogger = appLogger.namespace("LogKafkaConsumer");

export class LogKafkaConsumer extends AbstractKafkaConsumer {
  protected topic = "TRANSACTION" as const;
  protected consumerName = "log";

  constructor() {
    super();
  }

  protected async handler(
    eachMessagePayload: KafkaJS.EachMessagePayload,
  ): Promise<void> {
    const messageId = `${this.consumerName}-${eachMessagePayload.topic}-${eachMessagePayload.partition}-${eachMessagePayload.message.offset}`;

    const rawContent = eachMessagePayload.message.value;
    if (!rawContent) {
      throw new PayloadNotFoundException(messageId);
    }
    serviceLogger.info(
      `[MessageId: ${messageId}] message rawContent size: ${rawContent.byteLength}.`,
    );

    const rawDecodedContent =
      await kafkaConnection.decode<typeof this.topic>(rawContent);

    serviceLogger.info(
      `[MessageId: ${messageId}] message rawDecodedContent: ${rawDecodedContent.toString()}`,
    );

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

    await this.onFinish(eachMessagePayload, {
      transactionHash: hash,
      logs: transactionDb.receipt.logs.map((t) => t.logHash as Hash),
    });
  }

  protected async onFinish(
    eachMessagePayload: KafkaJS.EachMessagePayload,
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
    serviceLogger.info(
      `[MessageId: ${messageId}] Sent ${logs.length} messages to log topic.`,
    );
    return super.onFinish(eachMessagePayload, data);
  }
}
