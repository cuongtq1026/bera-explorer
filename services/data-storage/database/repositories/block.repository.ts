import type { Hash } from "viem";

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
