import { type LogDto, toLogDto } from "@database/dto.ts";
import prisma from "@database/prisma.ts";
import type { Hash } from "viem";

export type LogCreateInput = {
  logHash: string;
  address: string;
  data: string;
  blockNumber: bigint | number;
  transactionHash: string;
  transactionIndex: number;
  index: number;
  removed: boolean;

  topics: LogTopicCreateInput[];
};

export type LogTopicCreateInput = {
  topicHash: string;
  topic: string;
  index: number;
};

export async function findLogs(transactionHash: Hash): Promise<LogDto[]> {
  return prisma.log
    .findMany({
      where: {
        transactionHash,
      },
      include: {
        topics: true,
      },
    })
    .then((logs) => {
      return logs.map((log) => toLogDto(log));
    });
}
