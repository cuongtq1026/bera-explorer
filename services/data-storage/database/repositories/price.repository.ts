import prisma from "../prisma.ts";

export type PriceCreateInput = {
  tokenAddress: string;
  transactionHash: string;
  usd_price: string;
  createdAt: Date | string;
  swapId: bigint | number;
};

export function createPrice(priceCreateInput: PriceCreateInput) {
  return prisma.erc20Price.create({
    data: priceCreateInput,
  });
}

export function createPrices(priceCreateInputs: PriceCreateInput[]) {
  return prisma.erc20Price.createMany({
    data: priceCreateInputs,
  });
}

export async function deletePrices(swapId: bigint): Promise<void> {
  await prisma.erc20Price.deleteMany({
    where: {
      swapId,
    },
  });
}
