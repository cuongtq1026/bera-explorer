import type { Hash } from "viem";

import prisma from "../prisma.ts";

export type SwapCreateInput = {
  blockNumber: bigint | number;
  transactionHash: string;
  dex: string;
  from: string;
  to: string;
  fromAmount: string;
  toAmount: string;
  createdAt: Date | string;
};

export function createSwaps(inputs: SwapCreateInput[]) {
  return prisma.swap.createMany({
    data: inputs,
  });
}

export async function deleteSwaps(transactionHash: Hash): Promise<void> {
  await prisma.swap.deleteMany({
    where: {
      transactionHash,
    },
  });
}
