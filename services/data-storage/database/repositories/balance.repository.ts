import type { Hash } from "viem";

import prisma from "../prisma.ts";

export type BalanceCreateInput = {
  address: string;
  tokenAddress: string;
  amount: string;
  transferHash: string;
  lastUpdatedAt?: Date | string;
};

export function createBalance(balanceCreateInput: BalanceCreateInput) {
  return prisma.balance.create({
    data: balanceCreateInput,
  });
}

export function createBalances(balanceCreateInputs: BalanceCreateInput[]) {
  return prisma.balance.createMany({
    data: balanceCreateInputs,
  });
}

export async function deleteBalance(
  address: Hash,
  tokenAddress?: Hash,
): Promise<void> {
  await prisma.balance.deleteMany({
    where: {
      address,
      tokenAddress,
    },
  });
}
