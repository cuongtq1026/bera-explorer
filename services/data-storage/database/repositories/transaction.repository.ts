import prisma from "../prisma.ts";

export type TransactionCreateInput = {
  hash: string;
  nonce: bigint | number;
  blockHash?: string | null;
  blockNumber?: bigint | number | null;
  transactionIndex?: number | null;
  from: string;
  to?: string | null;
  input: string;
  value: bigint | number;
  gas: bigint | number;
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
