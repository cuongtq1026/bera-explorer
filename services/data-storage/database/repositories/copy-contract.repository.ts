import { type CopyContractDto, toCopyContractDto } from "@database/dto.ts";
import type { ContractCreateInput } from "@database/repositories/contract.repository.ts";
import type { Hash } from "viem";

import prisma from "../prisma.ts";

export type CopyContractCreateInput = {
  contractAddress: string;
  target: string;
  blockNumber: bigint | number;
  transactionHash: string;
  nftId: bigint | number;
  creator: string;
  factory: string;
  createdAt: Date | string;

  contract: ContractCreateInput;
};

export async function getCopyContracts(
  target: Hash,
): Promise<CopyContractDto[]> {
  return prisma.copyContract
    .findMany({
      where: {
        target,
      },
    })
    .then((copyContracts) => copyContracts.map((c) => toCopyContractDto(c)));
}

export async function createCopyContracts(
  inputs: CopyContractCreateInput[],
): Promise<void> {
  await prisma.$transaction([
    prisma.contract.createMany({
      data: inputs.map(({ contract }) => contract),
      skipDuplicates: true,
    }),
    prisma.copyContract.createMany({
      data: inputs.map(({ contract: _, ...input }) => ({
        ...input,
      })),
    }),
  ]);
}

export async function deleteCopyContracts(transactionHash: Hash) {
  return prisma.copyContract.deleteMany({
    where: {
      transactionHash,
    },
  });
}
