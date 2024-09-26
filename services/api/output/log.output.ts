import type { LogDto } from "../../data-storage/database/dto.ts";

export class LogOutput {
  logHash: string;
  address: string;
  data: string;
  blockNumber: string;
  transactionHash: string;
  transactionIndex: number;
  index: number;
  removed: boolean;
}

export function toLogOutput(logDto: LogDto): LogOutput {
  return {
    logHash: logDto.logHash,
    address: logDto.address,
    data: logDto.data,
    blockNumber: logDto.blockNumber.toString(),
    transactionHash: logDto.transactionHash,
    transactionIndex: logDto.transactionIndex,
    index: logDto.index,
    removed: logDto.removed,
  };
}
