import { type BlockDto } from "../../data-storage/database/dto.ts";
import {
  toTransactionOutput,
  TransactionOutput,
} from "./transaction.output.ts";

export class BlockOutput {
  number: string;
  hash: string;
  parentHash: string;
  nonce: string | null;
  sha3Uncles: string;
  logsBloom: string | null;
  transactionsRoot: string;
  stateRoot: string;
  receiptsRoot: string;
  miner: string;
  difficulty: string;
  totalDifficulty: string;
  extraData: string | null;
  size: string;
  gasLimit: string;
  gasUsed: string;
  createdAt: Date;

  transactions: TransactionOutput[];
}

export function toBlockOutput(block: BlockDto | null): BlockOutput | null {
  if (!block) return null;

  return {
    number: block.number.toString(),
    hash: block.hash,
    parentHash: block.parentHash,
    nonce: block.nonce,
    sha3Uncles: block.sha3Uncles,
    logsBloom: block.logsBloom,
    transactionsRoot: block.transactionsRoot,
    stateRoot: block.stateRoot,
    receiptsRoot: block.receiptsRoot,
    miner: block.miner,
    difficulty: block.difficulty.toString(),
    totalDifficulty: block.totalDifficulty.toString(),
    extraData: block.extraData,
    size: block.size.toString(),
    gasLimit: block.gasLimit.toString(),
    gasUsed: block.gasUsed.toString(),
    createdAt: new Date(Number(block.createdAt) * 1000),

    transactions: block.transactions.map(toTransactionOutput),
  };
}
