import { type LogDto, logToTransferDto } from "@database/dto.ts";
import { getLog } from "@database/repositories/log.repository.ts";
import {
  createTransfer,
  deleteTransferByHash,
  type TransferCreateInput,
} from "@database/repositories/transfer.repository.ts";
import type { Hash } from "viem";

import { NoGetResult } from "../exceptions/processor.exception.ts";
import logger from "../monitor/logger.ts";
import type { InterfaceProcessor } from "./interface.processor.ts";

export class LogProcessor
  implements
    InterfaceProcessor<
      Hash,
      LogDto,
      TransferCreateInput | null,
      { transferHash: Hash | null }
    >
{
  async get(id: Hash): Promise<LogDto> {
    const log = await getLog(id, {
      topics: true,
      block: true,
    });
    if (log == null) {
      throw new NoGetResult(id);
    }
    return log;
  }

  toInput(logDto: LogDto): TransferCreateInput | null {
    if (!logDto.topics) {
      throw Error("Topics is undefined");
    }
    if (!logDto.block) {
      throw Error("Block is undefined");
    }
    return logToTransferDto(
      logDto,
      logDto.topics,
      new Date(Number(logDto.block.createdAt) * 1000),
    );
  }

  async deleteFromDb(logHash: Hash): Promise<void> {
    await deleteTransferByHash(logHash);
  }

  async createInDb(inputs: TransferCreateInput): Promise<void> {
    await createTransfer(inputs);
  }

  async process(id: Hash): Promise<{ transferHash: Hash | null }> {
    logger.info("[LogKafkaProcessor] processing: " + id);

    const obj = await this.get(id);

    const input = this.toInput(obj);

    if (!input) {
      return {
        transferHash: null,
      };
    }

    await this.deleteFromDb(id);
    logger.info(`[LogKafkaProcessor] deleted ${id}`);
    await this.createInDb(input);
    logger.info(`[LogKafkaProcessor] created ${id}`);

    return {
      transferHash: input.hash,
    };
  }
}
