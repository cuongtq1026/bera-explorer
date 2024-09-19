import prisma from "../prisma.ts";

export type TransactionReceiptCreateInput = {
  transactionHash: string;
  transactionIndex: number;
  blockHash: string;
  blockNumber: bigint | number;
  from: string;
  to?: string | null;
  cumulativeGasUsed: bigint | number;
  gasUsed: bigint | number;
  contractAddress?: string | null;
  logs: any;
  logsBloom: string;
  status: boolean;
  effectiveGasPrice: bigint | number;
  type: string;
  root?: string | null;
};

export function createTransactionReceipt(
  transaction: TransactionReceiptCreateInput,
) {
  return prisma.transactionReceipt.create({
    data: transaction,
  });
}

export async function deleteTransactionReceipt(
  hash: `0x${string}`,
): Promise<void> {
  await prisma.transactionReceipt.deleteMany({
    where: {
      transactionHash: hash,
    },
  });
}
