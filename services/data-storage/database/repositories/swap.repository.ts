import { type SwapDto, toSwapDto } from "@database/dto.ts";
import type { Hash } from "viem";

import prisma from "../prisma.ts";

export type SwapCreateInput = {
  hash: string;
  blockNumber: bigint | number;
  transactionHash: string;
  transactionIndex: number;
  dex: string;
  from: string;
  to: string;
  fromAmount: string;
  toAmount: string;
  isRoot: boolean;
  parentHash: string | null;
  createdAt: Date | string;
};

export type SwapCreateChildrenInput = Omit<
  SwapCreateInput,
  "hash" | "isRoot" | "parentHash"
>;

export async function getSwap(swapHash: string): Promise<SwapDto | null> {
  return prisma.swap
    .findUnique({
      where: {
        hash: swapHash,
      },
    })
    .then((result) => {
      if (result == null) return null;

      return toSwapDto(result);
    });
}

export async function createAllSwapChildren(
  transactionHash: Hash,
  inputs: SwapCreateChildrenInput[],
): Promise<string[]> {
  if (!inputs.length) {
    return [];
  }

  const firstSwap = inputs[0];
  const lastSwap = inputs[inputs.length - 1];
  const isSingleRoute = inputs.length === 1;
  const rootSwap: SwapCreateInput = {
    hash: transactionHash,
    blockNumber: firstSwap.blockNumber,
    transactionHash: firstSwap.transactionHash,
    transactionIndex: firstSwap.transactionIndex,
    dex: firstSwap.dex,
    from: firstSwap.from,
    fromAmount: firstSwap.fromAmount,
    to: isSingleRoute ? firstSwap.to : lastSwap.to,
    toAmount: isSingleRoute ? firstSwap.toAmount : lastSwap.toAmount,
    isRoot: true,
    parentHash: null,
    createdAt: firstSwap.createdAt,
  };

  if (isSingleRoute) {
    const createdRootSwap = await prisma.swap.create({
      data: rootSwap,
    });

    return [createdRootSwap.hash];
  }
  return prisma.$transaction(async (tx) => {
    const createdRootSwap = await tx.swap.create({
      data: rootSwap,
    });
    const { hash: rootHash } = createdRootSwap;

    const childrenSwaps = await tx.swap.createManyAndReturn({
      data: inputs.map((input, index) => ({
        hash: `${transactionHash}-${index}`,
        blockNumber: input.blockNumber,
        transactionHash: input.transactionHash,
        transactionIndex: input.transactionIndex,
        dex: input.dex,
        from: input.from,
        fromAmount: input.fromAmount,
        to: input.to,
        toAmount: input.toAmount,
        isRoot: false,
        parentHash: rootHash,
        createdAt: input.createdAt,
      })),
    });

    return [rootHash, ...childrenSwaps.map(({ hash }) => hash)];
  });
}

export async function deleteSwaps(transactionHash: Hash): Promise<void> {
  await prisma.swap.deleteMany({
    where: {
      transactionHash,
    },
  });
}
