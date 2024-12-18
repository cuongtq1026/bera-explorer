import { toTransferDto, type TransferDto } from "@database/dto.ts";
import type { Prisma } from "@prisma/client";
import type { Hash } from "viem";

import { TransactionPaginationDto } from "../../../api/pagination.ts";
import prisma from "../prisma.ts";

export type TransferCreateInput = {
  hash: Hash;
  blockNumber: bigint;
  transactionHash: string;
  transactionIndex: number;
  logIndex: number;
  from: string;
  to: string;
  tokenAddress: string;
  amount: string;
  timestamp: Date | string;
};

export function createTransfers(transferCreateInputs: TransferCreateInput[]) {
  return prisma.transfer.createMany({
    data: transferCreateInputs,
  });
}

export function createTransfer(transferCreateInput: TransferCreateInput) {
  return prisma.transfer.create({
    data: transferCreateInput,
  });
}

export async function deleteTransferByTxHash(
  transactionHash: Hash,
): Promise<void> {
  await prisma.transfer.deleteMany({
    where: {
      transactionHash,
    },
  });
}

export async function deleteTransferByHash(logHash: Hash): Promise<void> {
  await prisma.transfer.deleteMany({
    where: {
      hash: logHash,
    },
  });
}

export async function getTransfer(hash: string): Promise<TransferDto | null> {
  return prisma.transfer
    .findUnique({
      where: {
        hash,
      },
    })
    .then((t) => {
      if (t == null) {
        return null;
      }
      return toTransferDto(t);
    });
}

export async function findTransfers(
  where?: {
    address?: string;
  },
  pagination?: TransactionPaginationDto,
) {
  const { page = 0, size = 20, cursor } = pagination ?? {};
  const skip = size * page;
  // build cursor
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
  const { address } = where ?? {};
  const whereAddress = address
    ? {
        OR: [{ from: address }, { to: address }],
      }
    : {};
  return prisma.transfer
    .findMany({
      where: {
        ...whereAddress,
      },
      take: size,
      skip: cursor == null ? skip : skip + 1,
      ...cursorObject,
      orderBy: [
        { blockNumber: "asc" },
        { transactionHash: "asc" },
        { logIndex: "asc" },
      ],
      include: {
        _count: true,
      },
    })
    .then((transfers) => transfers.map((t) => toTransferDto(t)));
}

export async function countTransfer() {
  return prisma.transfer.count({});
}
