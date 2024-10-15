import { BalanceConsumer } from "@consumers/balance.consumer.ts";
import { BlockConsumer } from "@consumers/block.consumer.ts";
import { BlockKafkaConsumer } from "@consumers/block.kafka.consumer.ts";
import { DlxConsumer } from "@consumers/dlx.consumer.ts";
import { InternalTransactionConsumer } from "@consumers/internal-transaction.consumer.ts";
import { TransactionConsumer } from "@consumers/transaction.consumer.ts";
import { TransactionReceiptConsumer } from "@consumers/transaction-receipt.consumer.ts";
import { TransactionReceiptKafkaConsumer } from "@consumers/transaction-receipt.kafka.consumer.ts";
import { TransferConsumer } from "@consumers/transfer.consumer.ts";
import { TransferKafkaConsumer } from "@consumers/transfer.kafka.consumer.ts";
import {
  countTransactions,
  findTransactions,
} from "@database/repositories/transaction.repository.ts";
import {
  countTransactionReceipts,
  findTransactionReceipts,
} from "@database/repositories/transaction-receipt.repository.ts";
import { BalanceProcessor } from "@processors/balance.processor.ts";
import { BlockProcessor } from "@processors/block.processor.ts";
import { InternalTransactionProcessor } from "@processors/internal-transaction.processor.ts";
import { TransactionProcessor } from "@processors/transaction.processor.ts";
import { TransactionReceiptProcessor } from "@processors/transaction-receipt.processor.ts";
import { TransferProcessor } from "@processors/transfer.processor.ts";
import type { Hash } from "viem";

import { queues } from "./services/config";
import logger from "./services/monitor/logger.ts";
import { setupPrometheus } from "./services/monitor/prometheus.ts";
import {
  queueBlock,
  QueueInternalTransactionPayload,
  queueTransaction,
  queueTransactionAggregator,
  QueueTransactionReceiptPayload,
} from "./services/queues/producers";
import mqConnection from "./services/queues/rabbitmq.connection.ts";
import { is0xHash, parseToBigInt } from "./services/utils.ts";

/**
 * 1. Get the latest block from DB.
 * 2. Verify block has all transactions and receipts.
 */

const [command, ...restArgs] = process.argv.slice(2);

logger.info(`Executing command ${command}...`);

switch (command) {
  case "block": {
    const blockNumber = parseToBigInt(restArgs[0]);
    if (blockNumber == null) {
      logger.info("Invalid block number.");
      break;
    }

    const processor = new BlockProcessor();
    await processor.process(blockNumber);
    break;
  }
  case "blocks": {
    const from = parseToBigInt(restArgs[0]);
    const to = parseToBigInt(restArgs[1]);
    if (from == null || to == null || from > to) {
      logger.info(`Invalid block number. from: ${from} | to: ${to}.`);
      break;
    }

    const processor = new BlockProcessor();
    for (let i = from; i <= to; i++) {
      await processor.process(i);
    }
    break;
  }
  case "transaction": {
    const transactionHash = restArgs[0];

    if (transactionHash == null || !is0xHash(transactionHash)) {
      logger.info("Invalid transaction hash.");
      break;
    }

    const processor = new TransactionProcessor();
    await processor.process(transactionHash);
    break;
  }
  case "transaction-receipt": {
    const transactionHash = restArgs[0];

    if (transactionHash == null || !is0xHash(transactionHash)) {
      logger.info("Invalid transaction hash.");
      break;
    }

    const processor = new TransactionReceiptProcessor();
    await processor.process(transactionHash);
    break;
  }
  case "internal-transaction": {
    const transactionHash = restArgs[0];

    if (transactionHash == null || !is0xHash(transactionHash)) {
      logger.info("Invalid transaction hash.");
      break;
    }

    const processor = new InternalTransactionProcessor();
    await processor.process(transactionHash);
    break;
  }
  case "transfer": {
    const transactionHash = restArgs[0];

    if (transactionHash == null || !is0xHash(transactionHash)) {
      logger.info("Invalid transaction hash.");
      break;
    }

    const processor = new TransferProcessor();
    await processor.process(transactionHash);
    break;
  }
  case "balance": {
    const transferHash = restArgs[0];

    if (transferHash == null || !is0xHash(transferHash)) {
      logger.info("Invalid transaction hash.");
      break;
    }

    const processor = new BalanceProcessor();

    await processor.process(transferHash);
    break;
  }
  case "queue": {
    const modelToQueue = restArgs[0];
    switch (modelToQueue) {
      case "block": {
        const blockNumber = parseToBigInt(restArgs[1]);
        if (blockNumber == null) {
          logger.info("Invalid block number.");
          break;
        }

        await queueBlock(blockNumber);
        break;
      }
      case "blocks": {
        const from = parseToBigInt(restArgs[1]);
        const to = parseToBigInt(restArgs[2]);
        if (from == null || to == null || from > to) {
          logger.info(`Invalid block number. from: ${from} | to: ${to}.`);
          break;
        }

        for (let i = from; i <= to; i++) {
          await queueBlock(i);
        }
        break;
      }
      case "transaction": {
        const transactionHash = restArgs[1];
        if (transactionHash == null || !is0xHash(transactionHash)) {
          logger.info("Invalid transaction hash.");
          break;
        }

        await queueTransaction(transactionHash);
        break;
      }
      case "transaction-aggregator": {
        const transactionHash = restArgs[1];
        if (transactionHash == null || !is0xHash(transactionHash)) {
          logger.info("Invalid transaction hash.");
          break;
        }

        await queueTransactionAggregator(transactionHash);
        break;
      }
      default: {
        logger.info(`No model to queue: ${modelToQueue}.`);
      }
    }
    break;
  }
  case "consume": {
    const modelToConsume = restArgs[0];
    switch (modelToConsume) {
      case "block": {
        setupPrometheus();

        const consumer = new BlockConsumer();

        await consumer.consume();
        break;
      }
      case "block-kafka": {
        setupPrometheus();

        const consumer = new BlockKafkaConsumer();

        await consumer.consume();
        break;
      }
      case "transaction-receipt-kafka": {
        setupPrometheus();

        const consumer = new TransactionReceiptKafkaConsumer();

        await consumer.consume();
        break;
      }
      case "transaction": {
        setupPrometheus();

        const consumer = new TransactionConsumer();

        await consumer.consume();
        break;
      }
      case "transaction-receipt": {
        setupPrometheus();

        const consumer = new TransactionReceiptConsumer();

        await consumer.consume();
        break;
      }
      case "internal-transaction": {
        setupPrometheus();

        const consumer = new InternalTransactionConsumer();

        await consumer.consume();
        break;
      }
      case "transfer": {
        setupPrometheus();

        const consumer = new TransferConsumer();

        await consumer.consume();
        break;
      }
      case "transfer-kafka": {
        setupPrometheus();

        const consumer = new TransferKafkaConsumer();

        await consumer.consume();
        break;
      }
      case "balance": {
        setupPrometheus();

        const balanceConsumer = new BalanceConsumer();

        await balanceConsumer.consume();
        break;
      }
      case "all": {
        setupPrometheus();

        const blockConsumer = new BlockConsumer();
        const transactionConsumer = new TransactionConsumer();
        const transactionReceiptConsumer = new TransactionReceiptConsumer();
        const internalTransactionConsumer = new InternalTransactionConsumer();
        const transferConsumer = new TransferConsumer();
        const balanceConsumer = new BalanceConsumer();

        await blockConsumer.consume();
        await transactionConsumer.consume();
        await transactionReceiptConsumer.consume();
        await internalTransactionConsumer.consume();
        await transferConsumer.consume();
        await balanceConsumer.consume();
        break;
      }
      default: {
        logger.info(`No model to consume: ${modelToConsume}.`);
      }
    }
    break;
  }
  case "retry-queue-all": {
    const dlxConsumer = new DlxConsumer();

    await dlxConsumer.consume();
    break;
  }
  /**
     * This command is created after "Internal transaction task" is created.
     * So you don't need this command to do anything

     * Queue all transaction receipts to internal transaction queue
     * Using cursor pagination
     */
  case "queue-internal-transaction": {
    const SIZE = 5000;
    const totalTransactionReceipts = await countTransactionReceipts();

    for (let i = 0, cursor: Hash | null = null, processed = 0; ; i++) {
      const receipts = await findTransactionReceipts({
        size: SIZE,
        cursor,
      });

      for (const receipt of receipts) {
        await mqConnection.publishToCrawlerExchange(
          queues.INTERNAL_TRANSACTION_QUEUE.routingKey,
          {
            transactionHash: receipt.transactionHash,
          } as QueueInternalTransactionPayload,
        );
      }

      processed += receipts.length;
      logger.info(
        `Queue internal transaction page ${i + 1}. Total receipts: ${receipts.length}. Processed: ${processed}/${totalTransactionReceipts}`,
      );

      if (receipts.length < SIZE) {
        break;
      }

      cursor = receipts[SIZE - 1].transactionHash;
    }
    logger.info("Queue internal transactions finished.");
    break;
  }
  /**
   * This command is created after "Aggregating erc20 transfer task" is created.
   * So you don't need this command to do anything
   *
   * Aggregator exchange is a fanout exchange which is used
   * to publish transactions after transaction receipt its logs are created
   * Queue published by exchange: Transfer
   *
   * Queue all transaction receipts to transaction aggregator exchange
   * Using cursor pagination
   */
  case "publish-transaction-aggregator": {
    const SIZE = 5000;
    const totalTransactionReceipts = await countTransactionReceipts();

    for (let i = 0, cursor: Hash | null = null, processed = 0; ; i++) {
      const receipts = await findTransactionReceipts({
        size: SIZE,
        cursor,
      });

      for (const receipt of receipts) {
        await queueTransactionAggregator(receipt.transactionHash);
      }

      processed += receipts.length;
      logger.info(
        `Publish page ${i + 1}. Total receipts: ${receipts.length}. Processed: ${processed}/${totalTransactionReceipts}`,
      );

      if (receipts.length < SIZE) {
        break;
      }

      cursor = receipts[SIZE - 1].transactionHash;
    }
    logger.info("Publish to aggregator exchange finished.");
    break;
  }
  case "find-missing-receipt": {
    const SIZE = 5000;
    const totalTransactions = await countTransactions();

    for (
      let i = 0, found = false, cursor: Hash | null = null, processed = 0;
      ;
      i++
    ) {
      const transactions = await findTransactions(
        {
          blockNumber: undefined,
        },
        {
          withReceipt: true,
        },
        {
          size: SIZE,
          cursor,
        },
      );

      for (const transaction of transactions) {
        if (transaction.receipt == null) {
          logger.info(
            `Found missing receipt for transaction ${transaction.hash}.`,
          );

          await mqConnection.publishToCrawlerExchange(
            queues.TRANSACTION_RECEIPT_QUEUE.routingKey,
            {
              transactionHash: transaction.hash,
            } as QueueTransactionReceiptPayload,
          );

          found = true;
          break;
        }
      }

      if (found) {
        break;
      }

      processed += transactions.length;
      logger.info(
        `Queue transaction receipts page ${i + 1}. Total transactions: ${transactions.length}. Processed: ${processed}/${totalTransactions}`,
      );

      if (transactions.length < SIZE) {
        break;
      }

      cursor = transactions[SIZE - 1].hash;
    }
    logger.info("Finished queueing missing receipts.");
    break;
  }
  default:
    logger.info(`No command: ${command}`);
    break;
}
