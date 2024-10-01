import type { Hash } from "viem";

import prisma from "../prisma.ts";

export type TransferCreateInput = {
  hash: string;
  blockNumber: bigint;
  transactionHash: string;
  from: string;
  to: string;
  tokenAddress: string;
  amount: string;
  logIndex: number;
  timestamp: Date | string;
};

export function createTransfers(transferCreateInputs: TransferCreateInput[]) {
  return prisma.transfer.createMany({
    data: transferCreateInputs,
  });
}

export async function deleteTransfer(transactionHash: Hash): Promise<void> {
  await prisma.transfer.deleteMany({
    where: {
      transactionHash,
    },
  });
}
