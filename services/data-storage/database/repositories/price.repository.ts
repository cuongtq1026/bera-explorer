import { type PriceDto, toPriceDto } from "@database/dto.ts";

import prisma from "../prisma.ts";

export type PriceCreateInput = {
  blockNumber: bigint | number;
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

export async function createPrices(
  priceCreateInputs: PriceCreateInput[],
): Promise<PriceDto[]> {
  const prices = await prisma.erc20Price.createManyAndReturn({
    data: priceCreateInputs,
  });
  return prices.map((price) => toPriceDto(price));
}

export async function deletePrices(swapId: number | bigint): Promise<void> {
  await prisma.erc20Price.deleteMany({
    where: {
      swapId,
    },
  });
}
