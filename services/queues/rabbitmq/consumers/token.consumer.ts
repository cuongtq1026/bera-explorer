import { ContractProcessor } from "@processors/contract.processor.ts";
import type { ConsumeMessage } from "amqplib";
import { plainToInstance } from "class-transformer";
import { validateOrReject } from "class-validator";

import { queues } from "../../../config";
import { appLogger } from "../../../monitor/app.logger.ts";
import { is0xHash } from "../../../utils.ts";
import { QueueTransactionAggregatorPayload } from "../producers";
import { AbstractRabbitMQConsumer } from "./rabbitmq.consumer.abstract.ts";

const serviceLogger = appLogger.namespace("TokenConsumer");

export class TokenConsumer extends AbstractRabbitMQConsumer {
  protected queueName = queues.TOKEN.name;

  constructor() {
    super({
      logger: appLogger.namespace(TokenConsumer.name),
    });
  }

  public async handler(message: ConsumeMessage): Promise<boolean> {
    const rawContent = message.content.toString();
    serviceLogger.info(`message rawContent: ${rawContent}.`);

    // transform
    const contentInstance = plainToInstance(
      QueueTransactionAggregatorPayload,
      JSON.parse(rawContent),
    );

    // validation
    await validateOrReject(contentInstance);
    const { transactionHash } = contentInstance;
    if (!is0xHash(transactionHash)) {
      throw Error(
        `[MessageId ${message.properties.messageId}] Invalid transaction hash.`,
      );
    }

    serviceLogger.info(
      `[MessageId: ${message.properties.messageId}] Processing token.`,
    );

    // process
    const processor = new ContractProcessor();
    await processor.process(transactionHash);

    serviceLogger.info(
      `[MessageId: ${message.properties.messageId}] Process transfer successful.`,
    );

    return true;
  }
}
