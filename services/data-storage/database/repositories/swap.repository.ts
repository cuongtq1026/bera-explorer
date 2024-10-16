import { type SwapDto, toSwapDto } from "@database/dto.ts";
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

export async function getSwap(swapId: bigint): Promise<SwapDto | null> {
  return prisma.swap
    .findUnique({
      where: {
        id: swapId,
      },
    })
    .then((result) => {
      if (result == null) return null;

      return toSwapDto(result);
    });
}

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
