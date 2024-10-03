import { type ContractDto, toContractDto } from "@database/dto.ts";
import type { Hash } from "viem";

import prisma from "../prisma.ts";

export type ContractCreateInput = {
  address: string;
  name?: string | null;
  deploymentTransactionHash: string;
  deploymentBlockNumber: bigint | number;
};

export function getContract(address: Hash): Promise<ContractDto | null> {
  return prisma.contract
    .findUnique({
      where: {
        address,
      },
    })
    .then((t) => {
      if (t == null) return null;
      return toContractDto(t);
    });
}

export function createContracts(contractCreateInputs: ContractCreateInput[]) {
  return prisma.contract.createMany({
    data: contractCreateInputs,
    skipDuplicates: true,
  });
}
