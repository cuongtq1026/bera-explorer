import {
  countBlock,
  findBlock,
} from "@database/repositories/block.repository.ts";
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
import { PriceProcessor } from "@processors/price.processor.ts";
import { SwapProcessor } from "@processors/swap.processor.ts";
import { TokenProcessor } from "@processors/token.processor.ts";
import { TransactionProcessor } from "@processors/transaction.processor.ts";
import { TransactionReceiptProcessor } from "@processors/transaction-receipt.processor.ts";
import { TransferProcessor } from "@processors/transfer.processor.ts";
import type { Hash } from "viem";

import { queues } from "./services/config";
import { appLogger } from "./services/monitor/app.logger.ts";
import { setupPrometheus } from "./services/monitor/prometheus.ts";
import { BalanceKafkaConsumer } from "./services/queues/kafka/consumers/balance.kafka.consumer.ts";
import { LogKafkaConsumer } from "./services/queues/kafka/consumers/log.kafka.consumer.ts";
import { PriceKafkaConsumer } from "./services/queues/kafka/consumers/price.kafka.consumer.ts";
import { SwapKafkaConsumer } from "./services/queues/kafka/consumers/swap.kafka.consumer.ts";
import { TransactionKafkaConsumer } from "./services/queues/kafka/consumers/transaction.kafka.consumer.ts";
import { TransferKafkaConsumer } from "./services/queues/kafka/consumers/transfer.kafka.consumer.ts";
import kafkaConnection from "./services/queues/kafka/kafka.connection.ts";
import { sendToBlockTopic } from "./services/queues/kafka/producers/block.kafka.producer.ts";
import { BlockConsumer } from "./services/queues/rabbitmq/consumers/block.consumer.ts";
import { DlxConsumer } from "./services/queues/rabbitmq/consumers/dlx.consumer.ts";
import { InternalTransactionConsumer } from "./services/queues/rabbitmq/consumers/internal-transaction.consumer.ts";
import { TokenConsumer } from "./services/queues/rabbitmq/consumers/token.consumer.ts";
import { TransactionConsumer } from "./services/queues/rabbitmq/consumers/transaction.consumer.ts";
import { TransactionReceiptConsumer } from "./services/queues/rabbitmq/consumers/transaction-receipt.consumer.ts";
import { TransferConsumer } from "./services/queues/rabbitmq/consumers/transfer.consumer.ts";
import {
  queueBlock,
  QueueInternalTransactionPayload,
  queueTransaction,
  queueTransactionAggregator,
  QueueTransactionReceiptPayload,
} from "./services/queues/rabbitmq/producers";
import mqConnection from "./services/queues/rabbitmq/rabbitmq.connection.ts";
import { is0xHash, parseToBigInt } from "./services/utils.ts";

/**
 * 1. Get the latest block from DB.
 * 2. Verify block has all transactions and receipts.
 */

const [command, ...restArgs] = process.argv.slice(2);

const serviceLogger = appLogger.namespace("main");
serviceLogger.info(`Executing command ${command}...`);

switch (command) {
  case "block": {
    const blockNumber = parseToBigInt(restArgs[0]);
    if (blockNumber == null) {
      serviceLogger.info("Invalid block number.");
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
      serviceLogger.info(`Invalid block number. from: ${from} | to: ${to}.`);
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
      serviceLogger.info("Invalid transaction hash.");
      break;
    }

    const processor = new TransactionProcessor();
    await processor.process(transactionHash);
    break;
  }
  case "transaction-receipt": {
    const transactionHash = restArgs[0];

    if (transactionHash == null || !is0xHash(transactionHash)) {
      serviceLogger.info("Invalid transaction hash.");
      break;
    }

    const processor = new TransactionReceiptProcessor();
    await processor.process(transactionHash);
    break;
  }
  case "internal-transaction": {
    const transactionHash = restArgs[0];

    if (transactionHash == null || !is0xHash(transactionHash)) {
      serviceLogger.info("Invalid transaction hash.");
      break;
    }

    const processor = new InternalTransactionProcessor();
    await processor.process(transactionHash);
    break;
  }
  case "transfer": {
    const transactionHash = restArgs[0];

    if (transactionHash == null || !is0xHash(transactionHash)) {
      serviceLogger.info("Invalid transaction hash.");
      break;
    }

    const processor = new TransferProcessor();
    await processor.process(transactionHash);
    break;
  }
  case "balance": {
    const transferHash = restArgs[0];

    if (transferHash == null || !is0xHash(transferHash)) {
      serviceLogger.info("Invalid transfer hash.");
      break;
    }

    const processor = new BalanceProcessor();

    await processor.process(transferHash);
    break;
  }
  case "token": {
    const transactionHash = restArgs[0];

    if (transactionHash == null || !is0xHash(transactionHash)) {
      serviceLogger.info("Invalid transaction hash.");
      break;
    }

    const processor = new TokenProcessor();

    await processor.process(transactionHash);
    break;
  }
  case "swap": {
    const transactionHash = restArgs[0];

    if (transactionHash == null || !is0xHash(transactionHash)) {
      serviceLogger.info("Invalid transaction hash.");
      break;
    }

    const processor = new SwapProcessor();

    await processor.process(transactionHash);
    break;
  }
  case "price": {
    const swapId = parseToBigInt(restArgs[0]);
    if (swapId == null) {
      serviceLogger.info("Invalid swapId number.");
      break;
    }
    const processor = new PriceProcessor();

    await processor.process(swapId);
    break;
  }
  case "queue": {
    const modelToQueue = restArgs[0];
    switch (modelToQueue) {
      case "block": {
        const blockNumber = parseToBigInt(restArgs[1]);
        if (blockNumber == null) {
          serviceLogger.info("Invalid block number.");
          break;
        }

        await queueBlock(blockNumber);
        break;
      }
      case "blocks": {
        const from = parseToBigInt(restArgs[1]);
        const to = parseToBigInt(restArgs[2]);
        if (from == null || to == null || from > to) {
          serviceLogger.info(
            `Invalid block number. from: ${from} | to: ${to}.`,
          );
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
          serviceLogger.info("Invalid transaction hash.");
          break;
        }

        await queueTransaction(transactionHash);
        break;
      }
      case "transaction-aggregator": {
        const transactionHash = restArgs[1];
        if (transactionHash == null || !is0xHash(transactionHash)) {
          serviceLogger.info("Invalid transaction hash.");
          break;
        }

        await queueTransactionAggregator(transactionHash);
        break;
      }
      default: {
        serviceLogger.info(`No model to queue: ${modelToQueue}.`);
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
      case "transaction-kafka": {
        setupPrometheus();

        const consumer = new TransactionKafkaConsumer();

        await consumer.consume();
        break;
      }
      case "log-kafka": {
        setupPrometheus();

        const consumer = new LogKafkaConsumer();

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
      case "balance-kafka": {
        setupPrometheus();

        const consumer = new BalanceKafkaConsumer();

        await consumer.consume();
        break;
      }
      case "transfer-kafka": {
        setupPrometheus();

        const consumer = new TransferKafkaConsumer();

        await consumer.consume();
        break;
      }
      case "token": {
        setupPrometheus();

        const tokenConsumer = new TokenConsumer();

        await tokenConsumer.consume();
        break;
      }
      case "swap-kafka": {
        setupPrometheus();

        const consumer = new SwapKafkaConsumer();

        await consumer.consume();
        break;
      }
      case "price-kafka": {
        setupPrometheus();

        const consumer = new PriceKafkaConsumer();

        await consumer.consume();
        break;
      }
      case "all": {
        setupPrometheus();

        const blockConsumer = new BlockConsumer();
        const transactionConsumer = new TransactionConsumer();
        const transactionReceiptConsumer = new TransactionReceiptConsumer();
        const internalTransactionConsumer = new InternalTransactionConsumer();
        const blockKafkaConsumer = new TransactionKafkaConsumer();
        const transactionReceiptKafkaConsumer = new LogKafkaConsumer();
        const logKafkaConsumer = new TransferKafkaConsumer();
        const balanceKafkaConsumer = new BalanceKafkaConsumer();
        const swapKafkaConsumer = new SwapKafkaConsumer();
        const priceKafkaConsumer = new PriceKafkaConsumer();

        await blockConsumer.consume();
        await transactionConsumer.consume();
        await transactionReceiptConsumer.consume();
        await internalTransactionConsumer.consume();
        await blockKafkaConsumer.consume();
        await transactionReceiptKafkaConsumer.consume();
        await logKafkaConsumer.consume();
        await balanceKafkaConsumer.consume();
        await swapKafkaConsumer.consume();
        await priceKafkaConsumer.consume();
        break;
      }
      default: {
        serviceLogger.info(`No model to consume: ${modelToConsume}.`);
      }
    }
    break;
  }
  case "send-blocks-topic": {
    const from = parseToBigInt(restArgs[0]);
    const to = parseToBigInt(restArgs[1]);
    if (from == null || to == null || from >= to) {
      serviceLogger.info(`Invalid block number. from: ${from} | to: ${to}.`);
      break;
    }

    const transaction = await kafkaConnection.transaction();

    try {
      const chunk = 10000n;
      for (let i = from; i <= to; i += chunk) {
        const maxSize = chunk > to - i ? to - i : chunk;
        await sendToBlockTopic(
          Array.from({
            length: Number(chunk > maxSize ? maxSize + 1n : chunk),
          }).map((_, index) => ({
            blockNumber: (i + BigInt(index)).toString(),
          })),
          {
            transaction,
          },
        );

        serviceLogger.debug(`Sent blocks ${i}-${i + maxSize} to block topic.`);
      }
      await transaction.commit();
      serviceLogger.info(`Finish send all messages to block topic.`);
    } catch (_: unknown) {
      await transaction.abort();
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
      serviceLogger.info(
        `Queue internal transaction page ${i + 1}. Total receipts: ${receipts.length}. Processed: ${processed}/${totalTransactionReceipts}`,
      );

      if (receipts.length < SIZE) {
        break;
      }

      cursor = receipts[SIZE - 1].transactionHash;
    }
    serviceLogger.info("Queue internal transactions finished.");
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
    const totalBlock = await countBlock();

    for (
      let blockNumber = 0n, processed = totalBlock;
      blockNumber < totalBlock;
      blockNumber++
    ) {
      const block = await findBlock(blockNumber, {
        withReceipts: true,
      });
      if (!block) {
        throw Error(`Block ${blockNumber} is not found.`);
      }
      if (!block.receipts) {
        throw Error(`Block transactions receipts ${blockNumber} is not found.`);
      }

      for (const receipt of block.receipts) {
        await queueTransactionAggregator(receipt.transactionHash);
      }

      processed += block.receipts.length;
      serviceLogger.info(
        `Publish block ${blockNumber}. Total receipts: ${block.receipts.length}. Processed block: ${blockNumber}/${totalBlock} | transactions: ${processed}.`,
      );
    }
    serviceLogger.info("Publish to aggregator exchange finished.");
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
          serviceLogger.info(
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
      serviceLogger.info(
        `Queue transaction receipts page ${i + 1}. Total transactions: ${transactions.length}. Processed: ${processed}/${totalTransactions}`,
      );

      if (transactions.length < SIZE) {
        break;
      }

      cursor = transactions[SIZE - 1].hash;
    }
    serviceLogger.info("Finished queueing missing receipts.");
    break;
  }
  default:
    serviceLogger.info(`No command: ${command}`);
    break;
}
