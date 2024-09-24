import logger from "./services/monitor/logger.ts";
import { setupPrometheus } from "./services/monitor/prometheus.ts";
import {
  processBlock,
  processTransaction,
  processTransactionReceipt,
} from "./services/processors";
import { BlockConsumer } from "./services/queues/consumers/block.consumer.ts";
import { TransactionConsumer } from "./services/queues/consumers/transaction.consumer.ts";
import { TransactionReceiptConsumer } from "./services/queues/consumers/transaction-receipt.consumer.ts";
import { queueBlock, queueTransaction } from "./services/queues/producers";
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

    await processBlock(blockNumber);
    break;
  }
  case "blocks": {
    const from = parseToBigInt(restArgs[0]);
    const to = parseToBigInt(restArgs[1]);
    if (from == null || to == null || from > to) {
      logger.info(`Invalid block number. from: ${from} | to: ${to}.`);
      break;
    }

    for (let i = from; i <= to; i++) {
      await processBlock(i);
    }
    break;
  }
  case "transaction": {
    const transactionHash = restArgs[0];

    if (transactionHash == null || !is0xHash(transactionHash)) {
      logger.info("Invalid transaction hash.");
      break;
    }

    await processTransaction(transactionHash);
    break;
  }
  case "transaction-receipt": {
    const transactionHash = restArgs[0];

    if (transactionHash == null || !is0xHash(transactionHash)) {
      logger.info("Invalid transaction hash.");
      break;
    }

    await processTransactionReceipt(transactionHash);
    break;
  }
  case "queue-block": {
    const blockNumber = parseToBigInt(restArgs[0]);
    if (blockNumber == null) {
      logger.info("Invalid block number.");
      break;
    }

    await queueBlock(blockNumber);
    break;
  }
  case "queue-blocks": {
    const from = parseToBigInt(restArgs[0]);
    const to = parseToBigInt(restArgs[1]);
    if (from == null || to == null || from > to) {
      logger.info(`Invalid block number. from: ${from} | to: ${to}.`);
      break;
    }

    for (let i = from; i <= to; i++) {
      await queueBlock(i);
    }

    break;
  }
  case "queue-transaction": {
    const transactionHash = restArgs[0];
    if (transactionHash == null || !is0xHash(transactionHash)) {
      logger.info("Invalid transaction hash.");
      break;
    }

    await queueTransaction(transactionHash);
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
      case "all": {
        setupPrometheus();

        const blockConsumer = new BlockConsumer();
        const transactionConsumer = new TransactionConsumer();
        const transactionReceiptConsumer = new TransactionReceiptConsumer();

        await blockConsumer.consume();
        await transactionConsumer.consume();
        await transactionReceiptConsumer.consume();
        break;
      }
      default: {
        logger.info(`No model to consume: ${modelToConsume}.`);
      }
    }
    break;
  }
  default:
    logger.info(`No command: ${command}`);
    break;
}
