import type {
  Balance,
  Block,
  InternalTransaction,
  Log,
  LogTopic,
  Transaction,
  TransactionReceipt,
  Transfer,
} from "@prisma/client";
import type { Hash } from "viem";

import { parseToBigInt } from "../../utils.ts";

export type BlockDto = {
  number: bigint;
  hash: string;
  parentHash: string;
  nonce: string | null;
  sha3Uncles: string;
  logsBloom: string | null;
  transactionsRoot: string;
  stateRoot: string;
  receiptsRoot: string;
  miner: string;
  difficulty: bigint;
  totalDifficulty: bigint;
  extraData: string | null;
  size: bigint;
  gasLimit: bigint;
  gasUsed: bigint;
  createdAt: bigint;

  _count?: {
    transactions?: number;
  };
  transactions?: TransactionDto[];
};
export type TransactionDto = {
  hash: Hash;
  nonce: bigint;
  blockHash: string | null;
  blockNumber: bigint;
  transactionIndex: number | null;
  from: string;
  to: string | null;
  input: string;
  value: bigint | null;
  chainId: number | null;
  gas: bigint;
  gasPrice: bigint | null;

  block?: BlockDto;
  receipt?: TransactionReceiptDto;
  transfers?: TransferDto[];
};
export type TransactionReceiptDto = {
  transactionHash: Hash;
  transactionIndex: number;
  blockHash: string;
  blockNumber: bigint;
  from: string;
  to: string | null;
  cumulativeGasUsed: bigint;
  gasUsed: bigint;
  contractAddress: string | null;
  logsBloom: string;
  status: boolean;
  effectiveGasPrice: bigint;
  type: string;
  root: string | null;
  createdAt: Date;

  block?: BlockDto;
  logs?: LogDto[];
};
export type LogTopicDto = {
  topicHash: string;
  topic: string;
  index: number;
  logHash: string;
};
export type LogDto = {
  logHash: Hash;
  address: string;
  data: string;
  blockNumber: bigint;
  transactionHash: string;
  transactionIndex: number;
  index: number;
  removed: boolean;

  topics?: LogTopicDto[];
};
export type InternalTransactionDto = {
  hash: string;
  parentHash: string | null;
  transactionHash: string;
  from: string;
  to: string;
  input: string;
  type: string;
  value: bigint;
  gas: bigint;
  gasUsed: bigint;
};
export type TransferDto = {
  hash: Hash;
  blockNumber: bigint;
  transactionHash: string;
  from: string;
  to: string;
  tokenAddress: string;
  amount: bigint;
  logIndex: number;
  timestamp: Date;
};
export type BalanceDto = {
  address: string;
  tokenAddress: string;
  amount: string;
  transferHash: string;
  lastUpdatedAt: Date;
};

export function toBlockDto(
  block: Block & {
    _count?: {
      transactions?: number;
    };
    transactions?: Transaction[];
  },
): BlockDto {
  const dto: BlockDto = {
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
    createdAt: block.createdAt,
  };
  if (block.transactions) {
    dto.transactions = block.transactions.map(toTransactionDto);
  }
  if (block._count) {
    dto._count = block._count;
  }
  return dto;
}

export function toTransactionDto(
  transaction: Transaction & {
    receipt?:
      | (TransactionReceipt & {
          logs?: Log[];
        })
      | null;
    block?: Block | null;
    transfers?: Transfer[];
  },
): TransactionDto {
  const dto: TransactionDto = {
    hash: transaction.hash as Hash,
    nonce: transaction.nonce,
    blockHash: transaction.blockHash,
    blockNumber: transaction.blockNumber,
    transactionIndex: transaction.transactionIndex,
    from: transaction.from,
    to: transaction.to,
    input: transaction.input,
    value: transaction.value
      ? parseToBigInt(transaction.value.toFixed())
      : null,
    chainId: transaction.chainId,
    gas: transaction.gas,
    gasPrice: transaction.gasPrice,
  };

  if (transaction.receipt) {
    dto.receipt = toTransactionReceiptDto(transaction.receipt);
  }
  if (transaction.block) {
    dto.block = toBlockDto(transaction.block);
  }
  if (transaction.transfers) {
    dto.transfers = transaction.transfers.map((t) => toTransferDto(t));
  }

  return dto;
}

export function toTransactionReceiptDto(
  receipt: TransactionReceipt & {
    logs?: Log[];
    block?: Block;
  },
): TransactionReceiptDto {
  const dto: TransactionReceiptDto = {
    transactionHash: receipt.transactionHash as Hash,
    transactionIndex: receipt.transactionIndex,
    blockHash: receipt.blockHash,
    blockNumber: receipt.blockNumber,
    from: receipt.from,
    to: receipt.to,
    cumulativeGasUsed: receipt.cumulativeGasUsed,
    gasUsed: receipt.gasUsed,
    contractAddress: receipt.contractAddress,
    logsBloom: receipt.logsBloom,
    status: receipt.status,
    effectiveGasPrice: receipt.effectiveGasPrice,
    type: receipt.type,
    root: receipt.root,
    createdAt: receipt.createdAt,
  };

  if (receipt.logs) {
    dto.logs = receipt.logs.map(toLogDto);
  }
  if (receipt.block) {
    dto.block = receipt.block;
  }

  return dto;
}

export function toLogDto(
  log: Log & {
    topics?: LogTopic[];
  },
): LogDto {
  const dto: LogDto = {
    logHash: log.logHash as Hash,
    address: log.address,
    data: log.data,
    blockNumber: log.blockNumber,
    transactionHash: log.transactionHash,
    transactionIndex: log.transactionIndex,
    index: log.index,
    removed: log.removed,
  };

  if (log.topics) {
    dto.topics = log.topics.map((topic) => toLogTopicDto(topic));
  }

  return dto;
}

export function toLogTopicDto(topic: LogTopic): LogTopicDto {
  return {
    topicHash: topic.topicHash,
    topic: topic.topic,
    index: topic.index,
    logHash: topic.logHash,
  };
}

export function toInternalTransactionDto(
  internalTransaction: InternalTransaction,
): InternalTransactionDto {
  return {
    hash: internalTransaction.hash,
    parentHash: internalTransaction.parentHash,
    transactionHash: internalTransaction.transactionHash,
    from: internalTransaction.from,
    to: internalTransaction.to,
    input: internalTransaction.input,
    type: internalTransaction.type,
    value: parseToBigInt(internalTransaction.value.toFixed()),
    gas: parseToBigInt(internalTransaction.gas.toFixed()),
    gasUsed: parseToBigInt(internalTransaction.gasUsed.toFixed()),
  };
}

export function toTransferDto(transfer: Transfer): TransferDto {
  return {
    hash: transfer.hash as Hash,
    blockNumber: transfer.blockNumber,
    transactionHash: transfer.transactionHash,
    from: transfer.from,
    to: transfer.to,
    tokenAddress: transfer.tokenAddress,
    amount: parseToBigInt(transfer.amount.toFixed()),
    logIndex: transfer.logIndex,
    timestamp: transfer.timestamp,
  };
}

export function toBalanceDto(balance: Balance): BalanceDto {
  return {
    address: balance.address,
    tokenAddress: balance.tokenAddress,
    amount: balance.amount.toString(),
    transferHash: balance.transferHash,
    lastUpdatedAt: balance.lastUpdatedAt,
  };
}
