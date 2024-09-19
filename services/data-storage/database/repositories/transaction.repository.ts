import type { Hash } from "viem";

import prisma from "../prisma.ts";

export type TransactionCreateInput = {
  hash: Hash;
  nonce: bigint | number;
  blockHash?: string | null;
  blockNumber?: bigint | number | null;
  transactionIndex?: number | null;
  from: string;
  to?: string | null;
  input: string;
  value: bigint | number;
  chainId?: number;
  gas: bigint | number;
  gasPrice?: bigint | number | null;
};

export function createTransaction(transaction: TransactionCreateInput) {
  return prisma.transaction.create({
    data: transaction,
  });
}

export async function deleteTransaction(hash: `0x${string}`): Promise<void> {
  await prisma.transaction.deleteMany({
    where: {
      hash,
    },
  });
}
