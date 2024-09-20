import {
  processBlock,
  processTransaction,
  processTransactionReceipt,
} from "./services/processors";
import { BlockConsumer } from "./services/queues/consumers/block.consumer.ts";
import { queueBlock } from "./services/queues/producers";
import { is0xHash, parseToBigInt } from "./services/utils.ts";

/**
 * 1. Get the latest block from DB.
 * 2. Verify block has all transactions and receipts.
 */

const [command, ...restArgs] = process.argv.slice(2);
switch (command) {
  case "block": {
    const blockNumber = parseToBigInt(restArgs[0]);
    if (blockNumber == null) {
      console.log("Invalid block number.");
      break;
    }

    await processBlock(blockNumber);
    break;
  }
  case "blocks": {
    const from = parseToBigInt(restArgs[0]);
    const to = parseToBigInt(restArgs[1]);
    if (from == null || to == null || from > to) {
      console.log(`Invalid block number. from: ${from} | to: ${to}.`);
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
      console.log("Invalid transaction hash.");
      break;
    }

    await processTransaction(transactionHash);
    break;
  }
  case "transaction-receipt": {
    const transactionHash = restArgs[0];

    if (transactionHash == null || !is0xHash(transactionHash)) {
      console.log("Invalid transaction hash.");
      break;
    }

    await processTransactionReceipt(transactionHash);
    break;
  }
  case "queue-block": {
    const blockNumber = parseToBigInt(restArgs[0]);
    if (blockNumber == null) {
      console.log("Invalid block number.");
      break;
    }

    await queueBlock(blockNumber);
    break;
  }
  case "queue-blocks": {
    const from = parseToBigInt(restArgs[0]);
    const to = parseToBigInt(restArgs[1]);
    if (from == null || to == null || from > to) {
      console.log(`Invalid block number. from: ${from} | to: ${to}.`);
      break;
    }

    for (let i = from; i <= to; i++) {
      await queueBlock(i);
    }

    break;
  }
  case "consume": {
    const modelToConsume = restArgs[0];
    switch (modelToConsume) {
      case "block": {
        const consumer = new BlockConsumer();

        await consumer.consume();
        break;
      }
      default: {
        console.log(`No model to consume: ${modelToConsume}.`);
      }
    }
    break;
  }
  default:
    console.log(`No command: ${command}`);
    break;
}
