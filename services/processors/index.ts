import {
  createBlock,
  deleteBlock,
} from "@database/repositories/block.repository.ts";
import {
  createInternalTransaction,
  deleteInternalTransaction,
} from "@database/repositories/internal-transaction.repository.ts";
import {
  createTransaction,
  deleteTransaction,
} from "@database/repositories/transaction.repository.ts";
import {
  createTransactionReceipt,
  deleteTransactionReceipt,
} from "@database/repositories/transaction-receipt.repository.ts";
import {
  toBlockCreateInput,
  toInternalTransactionCreateInput,
  toTransactionCreateInput,
  toTransactionReceiptCreateInput,
} from "@database/repositories/utils.ts";
import type { Hash } from "viem";

import {
  getAllTracerCallsTransaction,
  getBlock,
  getTransaction,
  getTransactionReceipt,
} from "../data-source";
import logger from "../monitor/logger.ts";

export async function processBlock(blockNumber: bigint): Promise<{
  transactions: Hash[];
}> {
  logger.info("[processBlock] processing block: " + blockNumber);

  const block = await getBlock(blockNumber);

  const createBlockInput = toBlockCreateInput(block);

  if (!createBlockInput) {
    throw Error("createBlockInput is null");
  }

  await deleteBlock(createBlockInput.number);
  logger.info(`[processBlock] block deleted ${createBlockInput.number}`);
  await createBlock(createBlockInput);
  logger.info("[processBlock] block created", createBlockInput.number);

  return {
    transactions: block.transactions as Hash[],
  };
}

export async function processTransaction(hash: Hash) {
  logger.info("[processTransaction] processing transaction", hash);
  const transaction = await getTransaction(hash);

  const createTransactionInput = toTransactionCreateInput(transaction);

  if (!createTransactionInput) {
    throw Error("createTransactionInput is null");
  }

  await deleteTransaction(createTransactionInput.hash);
  logger.info("transaction deleted: " + createTransactionInput.hash);
  await createTransaction(createTransactionInput);
  logger.info("transaction created: " + createTransactionInput.hash);
}

export async function processTransactionReceipt(hash: Hash) {
  logger.info(
    "[processTransactionReceipt] processing transaction receipt",
    hash,
  );
  const transactionReceipt = await getTransactionReceipt(hash);

  const createTransactionReceiptInput =
    toTransactionReceiptCreateInput(transactionReceipt);

  if (!createTransactionReceiptInput) {
    throw Error("createTransactionReceiptInput is null");
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

export async function processInternalTransaction(hash: Hash) {
  logger.info(
    "[processInternalTransaction] processing internal transaction",
    hash,
  );
  const internalTransaction = await getAllTracerCallsTransaction(hash);

  const createInternalTransactionInput = toInternalTransactionCreateInput(
    hash,
    null,
    0,
    internalTransaction,
  );

  if (!createInternalTransactionInput) {
    throw Error("createInternalTransactionInput is null");
  }

  await deleteInternalTransaction(
    createInternalTransactionInput.transactionHash,
  );
  logger.info(
    "internal transaction deleted",
    createInternalTransactionInput.transactionHash,
  );
  await createInternalTransaction(createInternalTransactionInput);
  logger.info(
    "internal transaction created",
    createInternalTransactionInput.transactionHash,
  );
}
