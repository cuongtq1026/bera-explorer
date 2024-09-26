import type { TransactionReceiptDto } from "../../data-storage/database/dto.ts";
import { type LogOutput, toLogOutput } from "./log.output.ts";

export class TransactionReceiptOutput {
  transactionHash: string;
  transactionIndex: number;
  blockHash: string;
  blockNumber: string;
  from: string;
  to: string | null;
  cumulativeGasUsed: string;
  gasUsed: string;
  contractAddress: string | null;
  logsBloom: string;
  status: boolean;
  effectiveGasPrice: string;
  type: string;
  root: string | null;
  createdAt: Date;

  logs?: LogOutput[];
}

export function toTransactionReceiptOutput(
  receipt: TransactionReceiptDto,
): TransactionReceiptOutput {
  return {
    transactionHash: receipt.transactionHash,
    transactionIndex: receipt.transactionIndex,
    blockHash: receipt.blockHash,
    blockNumber: receipt.blockNumber.toString(),
    from: receipt.from,
    to: receipt.to,
    cumulativeGasUsed: receipt.cumulativeGasUsed.toString(),
    gasUsed: receipt.gasUsed.toString(),
    contractAddress: receipt.contractAddress,
    logsBloom: receipt.logsBloom,
    status: receipt.status,
    effectiveGasPrice: receipt.effectiveGasPrice.toString(),
    type: receipt.type,
    root: receipt.root,
    createdAt: receipt.createdAt,

    logs: receipt.logs?.map(toLogOutput),
  };
}
