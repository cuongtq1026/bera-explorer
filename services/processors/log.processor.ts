import { type LogDto, logToTransferDto } from "@database/dto.ts";
import { getLog } from "@database/repositories/log.repository.ts";
import {
  createTransfer,
  deleteTransferByHash,
  type TransferCreateInput,
} from "@database/repositories/transfer.repository.ts";
import type { Hash } from "viem";

import { NoGetResult } from "../exceptions/processor.exception.ts";
import { appLogger } from "../monitor/app.logger.ts";
import type { InterfaceProcessor } from "./interface.processor.ts";

const serviceLogger = appLogger.namespace("LogProcessor");

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
    serviceLogger.info("processing: " + id);

    const obj = await this.get(id);

    const input = this.toInput(obj);

    if (!input) {
      return {
        transferHash: null,
      };
    }

    await this.deleteFromDb(id);
    serviceLogger.info(`deleted ${id}`);
    await this.createInDb(input);
    serviceLogger.info(`created ${id}`);

    return {
      transferHash: input.hash,
    };
  }
}
