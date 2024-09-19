import type { Hash } from "viem";

import prisma from "../prisma.ts";
import type { LogCreateInput } from "./log.repository.ts";

export type TransactionReceiptCreateInput = {
  transactionHash: Hash;
  transactionIndex: number;
  blockHash: string;
  blockNumber: bigint | number;
  from: string;
  to?: string | null;
  cumulativeGasUsed: bigint | number;
  gasUsed: bigint | number;
  contractAddress?: string | null;
  logsBloom: string;
  status: boolean;
  effectiveGasPrice: bigint | number;
  type: string;
  root?: string | null;

  logs: LogCreateInput[];
};

export function createTransactionReceipt(
  transaction: TransactionReceiptCreateInput,
) {
  const { logs, ...transactionReceiptData } = transaction;

  return prisma.transactionReceipt.create({
    data: {
      ...transactionReceiptData,
      logs: {
        create: logs.map((log) => ({
          ...({
            logHash: log.logHash,
            address: log.address,
            data: log.data,
            blockNumber: log.blockNumber,
            transactionIndex: log.transactionIndex,
            index: log.index,
            removed: log.removed,
          } as Omit<LogCreateInput, "topics" | "transactionHash">),
          topics: {
            createMany: {
              data: log.topics,
            },
          },
        })),
      },
    },
  });
}

export async function deleteTransactionReceipt(hash: Hash): Promise<void> {
  await prisma.transactionReceipt.deleteMany({
    where: {
      transactionHash: hash,
    },
  });
}
