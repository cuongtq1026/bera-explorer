import { toInternalTransactionDto } from "@database/dto.ts";
import { Prisma } from "@prisma/client";
import type { Hash } from "viem";

import prisma from "../prisma.ts";

export type InternalTransactionCreateInput = {
  hash: string;
  parentHash: string | null;
  transactionHash: Hash;
  from: string;
  to: string;
  input: string;
  type: string;
  value: string;
  gas: string;
  gasUsed: string;
  calls?: InternalTransactionCreateInput[];
};

function toRecursiveCallInput(
  calls: InternalTransactionCreateInput[],
): Prisma.InternalTransactionUncheckedCreateNestedManyWithoutParentInput {
  return {
    create: calls.map((call) => ({
      hash: call.hash,
      transactionHash: call.transactionHash,
      from: call.from,
      to: call.to,
      input: call.input,
      type: call.type,
      value: call.value,
      gas: call.gas,
      gasUsed: call.gasUsed,

      calls: call.calls ? toRecursiveCallInput(call.calls) : undefined,
    })),
  };
}

export function createInternalTransaction(
  internalTransaction: InternalTransactionCreateInput,
) {
  return prisma.internalTransaction.create({
    data: {
      hash: internalTransaction.hash,
      transactionHash: internalTransaction.transactionHash,
      from: internalTransaction.from,
      to: internalTransaction.to,
      input: internalTransaction.input,
      type: internalTransaction.type,
      value: internalTransaction.value,
      gas: internalTransaction.gas,
      gasUsed: internalTransaction.gasUsed,

      calls: internalTransaction.calls
        ? toRecursiveCallInput(internalTransaction.calls)
        : undefined,
    },
  });
}

export async function deleteInternalTransaction(
  transactionHash: Hash,
): Promise<void> {
  await prisma.internalTransaction.deleteMany({
    where: {
      transactionHash,
    },
  });
}

export async function findInternalTransactions(transactionHash: Hash) {
  return prisma.internalTransaction
    .findMany({
      where: {
        transactionHash,
      },
    })
    .then((internalTransactions) => {
      return internalTransactions.map((t) => toInternalTransactionDto(t));
    });
}
