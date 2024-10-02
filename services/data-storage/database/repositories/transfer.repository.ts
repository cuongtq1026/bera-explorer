import { toTransferDto } from "@database/dto.ts";
import { Prisma } from "@prisma/client";
import type { Hash } from "viem";

import { TransactionPaginationDto } from "../../../api/pagination.ts";
import prisma from "../prisma.ts";

export type TransferCreateInput = {
  hash: Hash;
  blockNumber: bigint;
  transactionHash: string;
  transactionIndex: number;
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

export async function findTransfers(pagination?: TransactionPaginationDto) {
  const { page = 0, size = 20, cursor } = pagination ?? {};
  const skip = size * page;
  const cursorObject:
    | {
        cursor: Prisma.TransferWhereUniqueInput;
      }
    | object =
    cursor == null
      ? {}
      : {
          cursor: {
            hash: cursor,
          } as Prisma.TransferWhereUniqueInput,
        };
  return prisma.transfer
    .findMany({
      take: size,
      skip: cursor == null ? skip : skip + 1,
      ...cursorObject,
      orderBy: [{ transactionHash: "asc" }, { logIndex: "asc" }],
    })
    .then((transfers) => transfers.map((t) => toTransferDto(t)));
}

export async function countTransfer() {
  return prisma.transfer.count({});
}
