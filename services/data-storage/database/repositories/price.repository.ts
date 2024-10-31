import { type PriceDto, toPriceDto } from "@database/dto.ts";

import prisma from "../prisma.ts";

export type PriceCreateInput = {
  hash: string;
  blockNumber: bigint | number;
  tokenAddress: string;
  transactionHash: string;
  transactionIndex: number;
  usdPrice: string;
  ethPrice: string;
  btcPrice: string;
  createdAt: Date | string;
  swapId: bigint | number;
  usdPriceRefHash?: string | null;
  ethPriceRefHash?: string | null;
  btcPriceRefHash?: string | null;
};

export async function createPricesAndReturn(
  priceCreateInputs: PriceCreateInput[],
): Promise<PriceDto[]> {
  const prices = await prisma.erc20Price.createManyAndReturn({
    data: priceCreateInputs,
  });
  return prices.map((price) => toPriceDto(price));
}

export async function createPrices(priceCreateInputs: PriceCreateInput[]) {
  return prisma.erc20Price.createMany({
    data: priceCreateInputs,
  });
}

export async function deletePrices(swapId: number | bigint) {
  return prisma.erc20Price.deleteMany({
    where: {
      swapId,
    },
  });
}

export async function replacePricesByBlockNumber(
  blockNumber: number | bigint,
  priceCreateInputs: PriceCreateInput[],
) {
  return prisma.$transaction([
    prisma.erc20Price.deleteMany({
      where: {
        blockNumber,
      },
    }),
    prisma.erc20Price.createMany({
      data: priceCreateInputs,
    }),
  ]);
}
