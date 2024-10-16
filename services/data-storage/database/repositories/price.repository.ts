import type { Hash } from "viem";

import prisma from "../prisma.ts";

export type PriceCreateInput = {
  tokenAddress: string;
  transactionHash: string;
  usd_price: string;
  createdAt: Date | string;
};

export function createPrices(priceCreateInputs: PriceCreateInput[]) {
  return prisma.erc20Price.createMany({
    data: priceCreateInputs,
  });
}

export async function deletePrices(transactionHash: Hash): Promise<void> {
  await prisma.erc20Price.deleteMany({
    where: {
      transactionHash,
    },
  });
}
