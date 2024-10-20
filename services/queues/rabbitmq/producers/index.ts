import { IsNotEmpty } from "class-validator";
import type { Hash } from "viem";

import {
  AGGREGATOR_TRANSACTION_ROUTING_KEY,
  aggregatorExchangeName,
  queues,
} from "../../../config";
import { appLogger } from "../../../monitor/app.logger.ts";
import mqConnection from "../rabbitmq.connection.ts";

const serviceLogger = appLogger.namespace("producers");

export class QueueBlockPayload {
  @IsNotEmpty()
  blockNumber: string;
}

export async function queueBlock(blockNumber: bigint) {
  await mqConnection.publishToCrawlerExchange(queues.BLOCK_QUEUE.routingKey, {
    blockNumber: String(blockNumber),
  } as QueueBlockPayload);

  serviceLogger.info(
    `[Block ${blockNumber}] Queued to ${queues.BLOCK_QUEUE.routingKey} key`,
  );
}

export class QueueTransactionPayload {
  @IsNotEmpty()
  transactionHash: string;
}

export class QueueTransactionReceiptPayload {
  @IsNotEmpty()
  transactionHash: string;
}

export class QueueBalancePayload {
  @IsNotEmpty()
  transferHash: string;
}

export class QueueInternalTransactionPayload {
  @IsNotEmpty()
  transactionHash: string;
}

export class QueueTransactionAggregatorPayload {
  @IsNotEmpty()
  transactionHash: string;
}

export async function queueTransaction(transactionHash: Hash) {
  await mqConnection.publishToCrawlerExchange(
    queues.TRANSACTION_QUEUE.routingKey,
    {
      transactionHash,
    } as QueueTransactionPayload,
  );

  serviceLogger.info(
    `[Transaction ${transactionHash}] Queued to ${queues.TRANSACTION_QUEUE.routingKey} key`,
  );
}

export async function queueTransactionAggregator(transactionHash: Hash) {
  const routingKey = AGGREGATOR_TRANSACTION_ROUTING_KEY;
  await mqConnection.publishFanoutExchange(
    aggregatorExchangeName,
    AGGREGATOR_TRANSACTION_ROUTING_KEY,
    {
      transactionHash,
    } as QueueTransactionAggregatorPayload,
  );

  serviceLogger.info(
    `[Transaction ${transactionHash}] Queued to ${routingKey} key`,
  );
}
