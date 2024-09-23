import type { Hash } from "viem";

import {
  getBlock,
  getTransaction,
  getTransactionReceipt,
} from "../data-source";
import {
  createBlock,
  deleteBlock,
} from "../data-storage/database/repositories/block.repository.ts";
import {
  createTransaction,
  deleteTransaction,
} from "../data-storage/database/repositories/transaction.repository.ts";
import {
  createTransactionReceipt,
  deleteTransactionReceipt,
} from "../data-storage/database/repositories/transaction-receipt.repository.ts";
import {
  toBlockCreateInput,
  toTransactionCreateInput,
  toTransactionReceiptCreateInput,
} from "../data-storage/database/repositories/utils.ts";

export async function processBlock(blockNumber: bigint) {
  logger.info("[processBlock] queueing block", blockNumber);

  const block = await getBlock(blockNumber);
  logger.info("[processBlock] raw block", block);

  if (block == null) {
    logger.error("Block is null");
    return;
  }

  const createBlockInput = toBlockCreateInput(block);

  if (!createBlockInput) {
    logger.error("createBlockInput is null");
    return;
  }

  await deleteBlock(createBlockInput.number);
  logger.info(`[processBlock] block deleted ${createBlockInput.number}`);
  await createBlock(createBlockInput);
  logger.info("[processBlock] block created", createBlockInput.number);
}

export async function processTransaction(hash: Hash) {
  logger.info("[processTransaction] queueing transaction", hash);
  const transaction = await getTransaction(hash);
  logger.info("[processTransaction] raw transaction", transaction);

  if (transaction == null) {
    logger.error("Transaction is null");
    return;
  }

  const createTransactionInput = toTransactionCreateInput(transaction);

  if (!createTransactionInput) {
    logger.error("createTransactionInput is null");
    return;
  }

  await deleteTransaction(createTransactionInput.hash);
  logger.info("transaction deleted");
  await createTransaction(createTransactionInput);
  logger.info("transaction created", createTransactionInput.hash);
}

export async function processTransactionReceipt(hash: Hash) {
  logger.info("[processTransactionReceipt] queueing transaction receipt", hash);
  const transactionReceipt = await getTransactionReceipt(hash);
  logger.info(
    "[processTransactionReceipt] raw transaction receipt",
    transactionReceipt,
  );

  if (transactionReceipt == null) {
    logger.error("Transaction receipt is null");
    return;
  }

  const createTransactionReceiptInput =
    toTransactionReceiptCreateInput(transactionReceipt);

  if (!createTransactionReceiptInput) {
    logger.error("createTransactionInput is null");
    return;
  }

  await deleteTransactionReceipt(createTransactionReceiptInput.transactionHash);
  logger.info(
    "transaction receipt deleted",
    createTransactionReceiptInput.transactionHash,
  );
  await createTransactionReceipt(createTransactionReceiptInput);
  logger.info(
    "transaction receipt created",
    createTransactionReceiptInput.transactionHash,
  );
}
