import { Prisma } from "@prisma/client";
import type { Hash } from "viem";

import { TransactionPaginationDto } from "../../../api/pagination.ts";
import { toTransactionDto, type TransactionDto } from "../dto.ts";
import prisma from "../prisma.ts";

export type TransactionCreateInput = {
  hash: Hash;
  nonce: bigint | number;
  blockHash?: string | null;
  blockNumber: bigint | number;
  transactionIndex?: number | null;
  from: string;
  to?: string | null;
  input: string;
  value: string;
  chainId?: number;
  gas: bigint | number;
  gasPrice?: bigint | number | null;
};

export function createTransaction(transaction: TransactionCreateInput) {
  return prisma.transaction.create({
    data: transaction,
  });
}

export async function deleteTransaction(hash: `0x${string}`): Promise<void> {
  await prisma.transaction.deleteMany({
    where: {
      hash,
    },
  });
}

export async function findTransaction(
  hash: Hash,
): Promise<TransactionDto | null> {
  return prisma.transaction
    .findUnique({
      where: {
        hash,
      },
    })
    .then((transaction) => {
      if (!transaction) return null;
      return toTransactionDto(transaction);
    });
}

export async function findTransactions(
  blockNumber: number | bigint,
  pagination?: TransactionPaginationDto,
): Promise<TransactionDto[]> {
  const { page = 0, size = 20, order = "asc", cursor } = pagination ?? {};
  const skip = size * page;
  const cursorObject:
    | {
        cursor: Prisma.TransactionWhereUniqueInput;
      }
    | object =
    cursor == null
      ? {}
      : {
          cursor: { hash: cursor },
        };
  return prisma.transaction
    .findMany({
      where: {
        blockNumber: blockNumber,
      },
      skip: cursor == null ? skip : skip + 1,
      take: size,
      orderBy: {
        transactionIndex: order,
      },
      ...cursorObject,
    })
    .then((transactions) =>
      transactions.map((transaction) => toTransactionDto(transaction)),
    );
}
