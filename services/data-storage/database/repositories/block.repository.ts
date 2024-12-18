import type { Prisma } from "@prisma/client";
import type { Hash } from "viem";

import { BlockPaginationDto } from "../../../api/pagination.ts";
import { type BlockDto, toBlockDto } from "../dto.ts";
import prisma from "../prisma.ts";

export type BlockCreateInput = {
  number: bigint;
  hash: Hash;
  parentHash: Hash;
  nonce?: string | null;
  sha3Uncles: string;
  logsBloom?: string | null;
  transactionsRoot: string;
  stateRoot: string;
  receiptsRoot: string;
  miner: string;
  difficulty: bigint | number;
  totalDifficulty: bigint | number;
  extraData?: string | null;
  size: bigint;
  gasLimit: bigint | number;
  gasUsed: bigint | number;
  createdAt: bigint;
};

export function createBlock(block: BlockCreateInput) {
  return prisma.block.create({
    data: block,
  });
}

export async function deleteBlock(number: bigint): Promise<void> {
  await prisma.block.deleteMany({
    where: {
      number,
    },
  });
}

export async function findBlock(
  number: bigint,
  options?: {
    withTransactions?: boolean;
    withReceipts?: boolean;
    count?: boolean;
  },
): Promise<BlockDto | null> {
  const {
    withTransactions = false,
    withReceipts = false,
    count = false,
  } = options ?? {};
  return prisma.block
    .findUnique({
      where: {
        number,
      },
      include: {
        transactions: withTransactions
          ? {
              include: {
                receipt: true,
              },
            }
          : false,
        receipts: withReceipts,
        _count: count,
      },
    })
    .then((block) => {
      if (!block) return null;
      return toBlockDto(block);
    });
}

export async function findBlocks(
  pagination?: BlockPaginationDto,
): Promise<BlockDto[]> {
  const { page = 0, size = 20, order = "desc", cursor } = pagination ?? {};
  const skip = size * page;
  const cursorObject:
    | {
        cursor: Prisma.BlockWhereUniqueInput;
      }
    | object =
    cursor == null
      ? {}
      : {
          cursor: { number: cursor },
        };
  return prisma.block
    .findMany({
      skip: cursor == null ? skip : skip + 1,
      take: size,
      orderBy: {
        number: order,
      },
      ...cursorObject,
    })
    .then((blocks) => blocks.map((block) => toBlockDto(block)));
}

export async function findBlocksWithGas(pagination?: BlockPaginationDto) {
  const { page = 0, size = 20, order = "desc", cursor } = pagination ?? {};
  const skip = size * page;
  const cursorObject:
    | {
        cursor: Prisma.BlockWhereUniqueInput;
      }
    | object =
    cursor == null
      ? {}
      : {
          cursor: { number: cursor },
        };
  return prisma.block.findMany({
    skip: cursor == null ? skip : skip + 1,
    take: size,
    orderBy: {
      number: order,
    },
    include: {
      transactions: {
        select: {
          gasPrice: true,
          receipt: {
            select: {
              gasUsed: true,
            },
          },
        },
      },
    },
    ...cursorObject,
  });
}

export async function countBlock() {
  return prisma.block.count({});
}
