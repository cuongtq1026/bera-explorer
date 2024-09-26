import type { TransactionDto } from "../../data-storage/database/dto.ts";

export class TransactionOutput {
  hash: string;
  nonce: string;
  blockHash: string | null;
  blockNumber: string;
  transactionIndex: number | null;
  from: string;
  to: string | null;
  input: string;
  value: string;
  chainId: number | null;
  gas: string;
  gasPrice: string | null;
}

export function toTransactionOutput(
  transaction: TransactionDto,
): TransactionOutput {
  return {
    hash: transaction.hash,
    nonce: transaction.nonce.toString(),
    blockHash: transaction.blockHash,
    blockNumber: transaction.blockNumber.toString(),
    transactionIndex: transaction.transactionIndex,
    from: transaction.from,
    to: transaction.to,
    input: transaction.input,
    value: transaction.value.toString(),
    chainId: transaction.chainId,
    gas: transaction.gas.toString(),
    gasPrice: transaction.gasPrice ? transaction.gasPrice.toString() : null,
  };
}
