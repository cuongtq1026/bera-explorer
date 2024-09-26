import type {
  Block,
  Log,
  Transaction,
  TransactionReceipt,
} from "@prisma/client";

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

  transactions: TransactionDto[];
};
export type TransactionDto = {
  hash: string;
  nonce: bigint;
  blockHash: string | null;
  blockNumber: bigint;
  transactionIndex: number | null;
  from: string;
  to: string | null;
  input: string;
  value: bigint;
  chainId: number | null;
  gas: bigint;
  gasPrice: bigint | null;

  receipt?: TransactionReceiptDto;
};
export type TransactionReceiptDto = {
  transactionHash: string;
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

  logs: LogDto[];
};
export type LogDto = {
  logHash: string;
  address: string;
  data: string;
  blockNumber: bigint;
  transactionHash: string;
  transactionIndex: number;
  index: number;
  removed: boolean;
};

export function toBlockDto(
  block: Block & {
    transactions?: Transaction[];
  },
): BlockDto {
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
    createdAt: block.createdAt,

    transactions: block.transactions
      ? block.transactions.map(toTransactionDto)
      : [],
  };
}

export function toTransactionDto(
  transaction: Transaction & {
    receipt?:
      | (TransactionReceipt & {
          logs: Log[];
        })
      | null;
  },
): TransactionDto {
  return {
    hash: transaction.hash,
    nonce: transaction.nonce,
    blockHash: transaction.blockHash,
    blockNumber: transaction.blockNumber,
    transactionIndex: transaction.transactionIndex,
    from: transaction.from,
    to: transaction.to,
    input: transaction.input,
    value: parseToBigInt(transaction.value.toString()),
    chainId: transaction.chainId,
    gas: transaction.gas,
    gasPrice: transaction.gasPrice,

    receipt: transaction.receipt
      ? toTransactionReceiptDto(transaction.receipt)
      : undefined,
  };
}

export function toTransactionReceiptDto(
  receipt: TransactionReceipt & {
    logs: Log[];
  },
): TransactionReceiptDto {
  return {
    transactionHash: receipt.transactionHash,
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

    logs: receipt.logs.map(toLogDto),
  };
}

export function toLogDto(log: Log): LogDto {
  return {
    logHash: log.logHash,
    address: log.address,
    data: log.data,
    blockNumber: log.blockNumber,
    transactionHash: log.transactionHash,
    transactionIndex: log.transactionIndex,
    index: log.index,
    removed: log.removed,
  };
}
