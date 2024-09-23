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
  console.log("[processBlock] queueing block", blockNumber);

  const block = await getBlock(blockNumber);
  console.log("[processBlock] raw block", block);

  if (block == null) {
    console.error("Block is null");
    return;
  }

  const createBlockInput = toBlockCreateInput(block);

  if (!createBlockInput) {
    console.error("createBlockInput is null");
    return;
  }

  await deleteBlock(createBlockInput.number);
  console.log(`[processBlock] block deleted ${createBlockInput.number}`);
  await createBlock(createBlockInput);
  console.log("[processBlock] block created", createBlockInput.number);
}

export async function processTransaction(hash: Hash) {
  console.log("[processTransaction] queueing transaction", hash);
  const transaction = await getTransaction(hash);
  console.log("[processTransaction] raw transaction", transaction);

  if (transaction == null) {
    console.error("Transaction is null");
    return;
  }

  const createTransactionInput = toTransactionCreateInput(transaction);

  if (!createTransactionInput) {
    console.error("createTransactionInput is null");
    return;
  }

  await deleteTransaction(createTransactionInput.hash);
  console.log("transaction deleted");
  await createTransaction(createTransactionInput);
  console.log("transaction created", createTransactionInput.hash);
}

export async function processTransactionReceipt(hash: Hash) {
  console.log("[processTransactionReceipt] queueing transaction receipt", hash);
  const transactionReceipt = await getTransactionReceipt(hash);
  console.log(
    "[processTransactionReceipt] raw transaction receipt",
    transactionReceipt,
  );

  if (transactionReceipt == null) {
    console.error("Transaction receipt is null");
    return;
  }

  const createTransactionReceiptInput =
    toTransactionReceiptCreateInput(transactionReceipt);

  if (!createTransactionReceiptInput) {
    console.error("createTransactionInput is null");
    return;
  }

  await deleteTransactionReceipt(createTransactionReceiptInput.transactionHash);
  console.log(
    "transaction receipt deleted",
    createTransactionReceiptInput.transactionHash,
  );
  await createTransactionReceipt(createTransactionReceiptInput);
  console.log(
    "transaction receipt created",
    createTransactionReceiptInput.transactionHash,
  );
}
