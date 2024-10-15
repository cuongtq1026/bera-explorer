import { type BalanceHistoryDto, toBalanceHistoryDto } from "@database/dto.ts";
import type { Hash } from "viem";

import prisma from "../prisma.ts";

export type BalanceHistoryCreateInput = {
  hash: string;
  blockNumber: bigint | number;
  transactionIndex: number;
  logIndex: number;
  index: number;
  transactionHash: string;
  transferHash: string;
  address: string;
  tokenAddress: string;
  amount: string;
  createdAt: Date | string;
};

export function getLatestBalanceHistory(
  address: string,
  tokenAddress: string,
): Promise<BalanceHistoryDto | null> {
  return prisma.balanceHistory
    .findFirst({
      where: {
        address,
        tokenAddress,
      },
      orderBy: [
        {
          blockNumber: "desc",
        },
        {
          transactionIndex: "desc",
        },
        {
          logIndex: "desc",
        },
      ],
    })
    .then((result) => {
      if (result == null) return null;
      return toBalanceHistoryDto(result);
    });
}

export function createBalanceHistories(
  balanceCreateInputs: BalanceHistoryCreateInput[],
) {
  return prisma.balanceHistory.createMany({
    data: balanceCreateInputs,
  });
}

export async function deleteBalanceHistory(
  transactionHash: Hash,
  transferHash: Hash,
): Promise<void> {
  await prisma.balanceHistory.deleteMany({
    where: {
      transactionHash,
      transferHash,
    },
  });
}
