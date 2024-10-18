import prisma from "@database/prisma.ts";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import type { EachMessagePayload } from "kafkajs";

import { ERC20_TRANSFER_SIGNATURE } from "../../../config/constants.ts";
import {
  InvalidPayloadException,
  KafkaReachedEndIndexedOffset,
  PayloadNotFoundException,
} from "../../../exceptions/consumer.exception.ts";
import logger from "../../../monitor/logger.ts";
import { LogMessagePayload, topics } from "../index.ts";
import kafkaConnection from "../kafka.connection.ts";
import { sendToTransferTopic } from "../producers";
import { AbstractKafkaConsumer } from "./kafka.consumer.abstract.ts";

/**
 * Steps:
 * - Get log from database, if it is not found, stop consumer and wait until it is indexed
 * - Check signature of log's topics, if it is not ERC20 Transfer, finish
 * - Check log.transfer, if it is not found, stop consumer and wait until it is indexed
 * - Send transfer to transfer topic
 */
export class TransferKafkaConsumer extends AbstractKafkaConsumer {
  protected topicName = topics.LOG.name;
  protected consumerName = "transfer";

  constructor() {
    super();
  }

  protected async handler(
    eachMessagePayload: EachMessagePayload,
  ): Promise<void> {
    const messageId = `${this.consumerName}-${eachMessagePayload.topic}-${eachMessagePayload.partition}-${eachMessagePayload.message.offset}`;

    const rawContent = eachMessagePayload.message.value;
    if (!rawContent) {
      throw new PayloadNotFoundException(messageId);
    }
    logger.info(
      `[MessageId: ${messageId}] TransferKafkaConsumer message rawContent size: ${rawContent.byteLength}.`,
    );

    const rawDecodedContent = await kafkaConnection.decode(rawContent);

    logger.info(
      `[MessageId: ${messageId}] TransferKafkaConsumer message rawDecodedContent: ${rawDecodedContent.toString()}`,
    );

    // transform
    const contentInstance = plainToInstance(
      LogMessagePayload,
      JSON.parse(rawContent.toString()),
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
      const signature = logDb.topics[0]?.topic;
      if (signature !== ERC20_TRANSFER_SIGNATURE) {
        await this.onFinish(eachMessagePayload, {
          transferHash: null,
        });
        return;
      }
    }

    if (!logDb.transfer) {
      // TODO: Wait until data indexed
      throw new KafkaReachedEndIndexedOffset(
        eachMessagePayload.topic,
        this.consumerName,
        logHash,
      );
    }

    await this.onFinish(eachMessagePayload, {
      transferHash: logDb.transfer.hash,
    });
    return;
  }

  protected async onFinish(
    eachMessagePayload: EachMessagePayload,
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
    logger.info(
      `[MessageId: ${messageId}] Sent ${transferHash} message to transfer topic.`,
    );
    return super.onFinish(eachMessagePayload, data);
  }
}
