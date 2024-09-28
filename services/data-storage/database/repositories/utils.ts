import type {
  Block,
  GetTransactionReceiptReturnType,
  GetTransactionReturnType,
  Hash,
  Log,
} from "viem";

import type { TraceCallNested } from "../../../data-source/rpc-request/types.ts";
import type { BlockCreateInput } from "./block.repository.ts";
import type { InternalTransactionCreateInput } from "./internal-transaction.repository.ts";
import type { LogCreateInput, LogTopicCreateInput } from "./log.repository.ts";
import type { TransactionCreateInput } from "./transaction.repository.ts";
import type { TransactionReceiptCreateInput } from "./transaction-receipt.repository.ts";

export function toBlockCreateInput(block: Block): BlockCreateInput | null {
  if (
    block.number == null ||
    block.hash == null ||
    block.totalDifficulty == null
  ) {
    return null;
  }

  return {
    number: block.number,
    hash: block.hash,
    parentHash: block.parentHash,
    nonce: block.nonce,
    sha3Uncles: block.sha3Uncles,
    logsBloom: block.logsBloom,
    transactionsRoot: block.transactionsRoot,
    stateRoot: block.stateRoot,
    receiptsRoot: block.receiptsRoot,
    miner: block.miner,
    difficulty: block.difficulty,
    totalDifficulty: block.totalDifficulty,
    extraData: block.extraData,
    size: block.size,
    gasLimit: block.gasLimit,
    gasUsed: block.gasUsed,
    createdAt: block.timestamp,
  };
}

export function toTransactionCreateInput(
  transaction: GetTransactionReturnType,
): TransactionCreateInput | null {
  if (transaction.blockNumber == null) {
    return null;
  }

  return {
    hash: transaction.hash,
    nonce: transaction.nonce,
    blockHash: transaction.blockHash,
    transactionIndex: transaction.transactionIndex,
    blockNumber: transaction.blockNumber,
    from: transaction.from,
    to: transaction.to,
    value: transaction.value.toString(),
    input: transaction.input,
    gas: transaction.gas,
    gasPrice: transaction.gasPrice,
    chainId: transaction.chainId,
  };
}

export function toTransactionReceiptCreateInput(
  transaction: GetTransactionReceiptReturnType,
): TransactionReceiptCreateInput | null {
  if (transaction.blockNumber == null) {
    return null;
  }

  return {
    transactionHash: transaction.transactionHash,
    transactionIndex: transaction.transactionIndex,
    blockHash: transaction.blockHash,
    blockNumber: transaction.blockNumber,
    from: transaction.from,
    to: transaction.to,
    cumulativeGasUsed: transaction.cumulativeGasUsed,
    gasUsed: transaction.gasUsed,
    contractAddress: transaction.contractAddress,
    logsBloom: transaction.logsBloom,
    status: transaction.status === "success",
    effectiveGasPrice: transaction.effectiveGasPrice,
    type: transaction.type,
    root: transaction.root,

    logs: transaction.logs
      .map((log) => toLogCreateInput(log))
      .filter((log) => log != null),
  };
}

export function toLogCreateInput(log: Log): LogCreateInput | null {
  if (
    log.blockNumber == null ||
    log.transactionHash == null ||
    log.logIndex == null ||
    log.transactionIndex == null
  ) {
    return null;
  }

  const logHash = `${log.transactionHash}-${log.transactionIndex}-${log.logIndex}`;
  return {
    logHash: logHash,
    address: log.address,
    data: log.data,
    blockNumber: log.blockNumber,
    transactionHash: log.transactionHash,
    transactionIndex: log.transactionIndex,
    index: log.logIndex,
    removed: log.removed,

    topics: log.topics.map((topic, index) =>
      toLogTopicCreateInput(logHash, index, topic),
    ),
  };
}

export function toLogTopicCreateInput(
  logHash: string,
  index: number,
  logTopic: Hash,
): LogTopicCreateInput {
  return {
    topicHash: `${logHash}-${index}`,
    topic: logTopic,
    index,
  };
}

export function toInternalTransactionCreateInput(
  transactionHash: Hash,
  parentHash: string | null,
  index: number,
  internalTransaction: TraceCallNested,
): InternalTransactionCreateInput {
  const hash = parentHash == null ? transactionHash : `${parentHash}-${index}`;
  return {
    hash,
    parentHash,
    transactionHash,
    from: internalTransaction.from,
    gas: BigInt(internalTransaction.gas).toString(),
    gasUsed: BigInt(internalTransaction.gasUsed).toString(),
    input: internalTransaction.input,
    to: internalTransaction.to,
    type: internalTransaction.type,
    value: internalTransaction.value
      ? BigInt(internalTransaction.value).toString()
      : "0",

    calls: internalTransaction.calls
      ? internalTransaction.calls.map((call, index) =>
          toInternalTransactionCreateInput(transactionHash, hash, index, call),
        )
      : undefined,
  };
}
