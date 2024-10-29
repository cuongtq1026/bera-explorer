import type { SwapCreateInput } from "@database/repositories/swap.repository.ts";
import type { TransferCreateInput } from "@database/repositories/transfer.repository.ts";
import type {
  Balance,
  BalanceHistory,
  Block,
  Contract,
  Erc20Price,
  InternalTransaction,
  Log,
  LogTopic,
  Swap,
  Token,
  Transaction,
  TransactionReceipt,
  Transfer,
} from "@prisma/client";
import { decodeEventLog, erc20Abi, type Hash, type Hex } from "viem";

import { WBeraAbi } from "../../config/abis";
import {
  ERC20_TRANSFER_SIGNATURE,
  WITHDRAWAL_SIGNATURE,
} from "../../config/constants.ts";
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
  receipts?: TransactionReceiptDto[];
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

  block?: BlockDto;
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
  transactionHash: Hash;
  from: string;
  to: string;
  tokenAddress: string;
  amount: bigint;
  logIndex: number;
  transactionIndex: number;
  timestamp: Date;
};
export type BalanceDto = {
  address: string;
  tokenAddress: string;
  amount: string;
  transferHash: string;
  lastUpdatedAt: Date;
};
export type BalanceHistoryDto = {
  hash: Hash;
  blockNumber: bigint | number;
  transactionIndex: number;
  logIndex: number;
  index: number;
  transactionHash: Hash;
  transferHash: string;
  address: string;
  tokenAddress: string;
  amount: bigint;
  createdAt: Date | string;
};
/**
 * ERC20 Token
 */
export type TokenDto = {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: bigint;
};
export type ContractDto = {
  address: string;
  name?: string | null;
  deploymentTransactionHash: string;
  deploymentBlockNumber: bigint | number;
};
export type PriceDto = {
  id: bigint | number;
  blockNumber: bigint | number;
  tokenAddress: string;
  transactionHash: string;
  swapId: bigint | number;
  usd_price: bigint;
  createdAt: Date;
};

export type SwapDto = {
  id: bigint | number;
  blockNumber: bigint | number;
  transactionHash: string;
  dex: string;
  from: string;
  to: string;
  fromAmount: bigint;
  toAmount: bigint;
  createdAt: Date;
};

export type SwapDtoNoId = Omit<SwapDto, "id">;

export function isERC20TransferLog(
  topics: Pick<LogTopicDto, "topic">[],
): boolean {
  if (topics.length === 0) {
    return false;
  }
  const signature = topics[0].topic as Hex;
  return (
    signature === ERC20_TRANSFER_SIGNATURE &&
    // length 3: ERC20
    // length 4: ERC721 (NFT)
    topics.length === 3
  );
}

export function decodeTransferLog(
  log: LogDto,
  topics: LogTopicDto[],
): {
  tokenAddress: Hash;
  from: Hash;
  to: Hash;
  value: bigint;
} | null {
  const signature = topics[0].topic as Hex;
  if (!isERC20TransferLog(topics)) {
    return null;
  }
  const logTopics = topics.slice(1).map((t) => t.topic as Hex);
  const decodedTopics = decodeEventLog({
    abi: erc20Abi,
    eventName: "Transfer",
    data: log.data as Hash,
    topics: [signature, ...logTopics],
  });

  return {
    tokenAddress: log.address as Hash,
    from: decodedTopics.args.from.toLowerCase() as Hash,
    to: decodedTopics.args.to.toLowerCase() as Hash,
    value: decodedTopics.args.value,
  };
}

export function decodeWithdrawalLog(
  log: LogDto,
  topics: LogTopicDto[],
): {
  to: Hash;
  amount: bigint;
} | null {
  const signature = topics[0].topic as Hex;
  if (signature !== WITHDRAWAL_SIGNATURE) {
    return null;
  }
  const logTopics = topics.slice(1).map((t) => t.topic as Hex);
  const decodedTopics = decodeEventLog({
    abi: WBeraAbi,
    eventName: "Withdrawal",
    data: log.data as Hash,
    topics: [signature, ...logTopics],
  });

  return {
    amount: decodedTopics.args.amount,
    to: decodedTopics.args.to.toLowerCase() as Hash,
  };
}

export function logToTransferDto(
  log: LogDto,
  topics: LogTopicDto[],
  createdAt: Date,
): TransferCreateInput | null {
  const decodedTopics = decodeTransferLog(log, topics);
  if (decodedTopics == null) {
    return null;
  }
  return {
    hash: log.logHash,
    from: decodedTopics.from,
    to: decodedTopics.to,
    amount: decodedTopics.value.toString(),
    tokenAddress: log.address,
    logIndex: log.index,
    timestamp: createdAt,
    transactionHash: log.transactionHash,
    blockNumber: log.blockNumber,
    transactionIndex: log.transactionIndex,
  };
}

export function toBlockDto(
  block: Block & {
    _count?: {
      transactions?: number;
    };
    transactions?: Transaction[];
    receipts?: TransactionReceipt[];
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
  if (block.receipts) {
    dto.receipts = block.receipts.map(toTransactionReceiptDto);
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
    block?: Block;
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

  if (log.block) {
    dto.block = toBlockDto(log.block);
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
    transactionHash: transfer.transactionHash as Hash,
    transactionIndex: transfer.transactionIndex,
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

export function toTokenDto(token: Token): TokenDto {
  return {
    address: token.address,
    name: token.name,
    symbol: token.symbol,
    decimals: token.decimals,
    totalSupply: BigInt(token.totalSupply.toFixed()),
  };
}

export function toContractDto(contract: Contract): ContractDto {
  return {
    address: contract.address,
    name: contract.name,
    deploymentTransactionHash: contract.deploymentTransactionHash,
    deploymentBlockNumber: contract.deploymentBlockNumber,
  };
}

export function toBalanceHistoryDto(
  balanceHistory: BalanceHistory,
): BalanceHistoryDto {
  return {
    hash: balanceHistory.address as Hash,
    blockNumber: balanceHistory.blockNumber,
    transactionIndex: balanceHistory.transactionIndex,
    logIndex: balanceHistory.logIndex,
    index: balanceHistory.index,
    transactionHash: balanceHistory.transactionHash as Hash,
    transferHash: balanceHistory.transferHash,
    address: balanceHistory.address,
    tokenAddress: balanceHistory.tokenAddress,
    amount: parseToBigInt(balanceHistory.amount.toFixed()),
    createdAt: balanceHistory.createdAt,
  };
}

export function dtoToSwapCreateInput(swapDto: SwapDto): SwapCreateInput {
  return {
    blockNumber: swapDto.blockNumber,
    transactionHash: swapDto.transactionHash,
    dex: swapDto.dex,
    from: swapDto.from,
    to: swapDto.to,
    fromAmount: swapDto.fromAmount.toString(),
    toAmount: swapDto.toAmount.toString(),
    createdAt: swapDto.createdAt,
  };
}

export function toSwapDto(swap: Swap): SwapDto {
  return {
    id: swap.id,
    blockNumber: swap.blockNumber,
    transactionHash: swap.transactionHash as Hash,
    dex: swap.dex as Hash,
    from: swap.from,
    to: swap.to,
    fromAmount: parseToBigInt(swap.fromAmount.toFixed()),
    toAmount: parseToBigInt(swap.toAmount.toFixed()),
    createdAt: swap.createdAt,
  };
}

export function toPriceDto(price: Erc20Price): PriceDto {
  return {
    id: price.id,
    blockNumber: price.blockNumber,
    swapId: price.swapId,
    tokenAddress: price.tokenAddress,
    usd_price: parseToBigInt(price.usd_price.toFixed()),
    createdAt: price.createdAt,
    transactionHash: price.transactionHash as Hash,
  };
}
