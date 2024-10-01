import type {
  LogDto,
  LogTopicDto,
  TransactionReceiptDto,
} from "@database/dto.ts";
import { findTransactionReceipt } from "@database/repositories/transaction-receipt.repository.ts";
import {
  createTransfers,
  deleteTransfer,
  type TransferCreateInput,
} from "@database/repositories/transfer.repository.ts";
import { decodeEventLog, erc20Abi, type Hash, type Hex } from "viem";

import { ERC20_TRANSFER_TOPIC } from "../config/constants.ts";
import logger from "../monitor/logger.ts";
import type { InterfaceProcessor } from "./interface.processor.ts";

type ToInputArgType = TransactionReceiptDto & {
  logs: LogDto[];
};
export type CreatedHash = { hash: Hash; index: number };

export class TransferProcessor
  implements
    InterfaceProcessor<
      Hash,
      ToInputArgType,
      TransferCreateInput[],
      CreatedHash[],
      void,
      CreatedHash[]
    >
{
  async get(id: Hash): Promise<ToInputArgType> {
    const receipt = await findTransactionReceipt(id, {
      withLogs: true,
    });
    if (!receipt) {
      throw new Error(`Transaction receipt not found`);
    }
    const logs = receipt.logs;
    if (!logs) {
      throw new Error(`Transaction receipt logs not found`);
    }
    return {
      transactionHash: receipt.transactionHash as Hash,
      transactionIndex: receipt.transactionIndex,
      blockHash: receipt.blockHash,
      blockNumber: receipt.blockNumber,
      from: receipt.from,
      to: receipt.to,
      cumulativeGasUsed: receipt.cumulativeGasUsed,
      gasUsed: receipt.gasUsed,
      contractAddress: receipt.contractAddress,
      logsBloom: receipt.logsBloom,
      status: receipt.status,
      effectiveGasPrice: receipt.effectiveGasPrice,
      type: receipt.type,
      root: receipt.root,
      createdAt: receipt.createdAt,
      logs,
    };
  }

  toInput(input: ToInputArgType): TransferCreateInput[] {
    return input.logs
      .filter(
        (
          log,
        ): log is LogDto & {
          topics: LogTopicDto[];
        } => log.topics != null,
      )
      .filter((log) => log.topics[0]?.topic === ERC20_TRANSFER_TOPIC)
      .map<TransferCreateInput>((log) => {
        const signature = log.topics[0].topic as Hex;
        const logTopics = log.topics.slice(1).map((t) => t.topic as Hex);
        const topics = decodeEventLog({
          abi: erc20Abi,
          eventName: "Transfer",
          data: log.data as Hash,
          topics: [signature, ...logTopics],
        });
        return {
          from: topics.args.from.toLowerCase(),
          to: topics.args.to.toLowerCase(),
          amount: topics.args.value.toString(),
          tokenAddress: log.address,
          logIndex: log.index,
          timestamp: input.createdAt,
          transactionHash: log.transactionHash,
          blockNumber: log.blockNumber,
          hash: log.logHash,
        };
      });
  }

  async deleteFromDb(id: Hash): Promise<void> {
    await deleteTransfer(id);
  }

  async createInDb(inputs: TransferCreateInput[]): Promise<CreatedHash[]> {
    await createTransfers(inputs);

    return inputs.map((input) => ({
      hash: input.hash,
      index: input.logIndex,
    }));
  }

  async process(id: Hash): Promise<CreatedHash[]> {
    logger.info("[TransferProcessor] processing: " + id);

    const obj = await this.get(id);

    const inputs = this.toInput(obj);

    await this.deleteFromDb(id);
    logger.info(`[TransferProcessor] deleted ${id}`);
    const result = await this.createInDb(inputs);
    logger.info(`[TransferProcessor] created ${id}`);

    return result;
  }
}