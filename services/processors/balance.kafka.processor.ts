import type { TransferDto } from "@database/dto.ts";
import {
  type BalanceHistoryCreateInput,
  createBalanceHistories,
  deleteBalanceHistory,
  getLatestBalanceHistory,
} from "@database/repositories/balance-history.repository.ts";
import { getTransfer } from "@database/repositories/transfer.repository.ts";
import type { Hash } from "viem";

import { NoGetResult } from "../exceptions/processor.exception.ts";
import { appLogger } from "../monitor/app.logger.ts";
import type { InterfaceProcessor } from "./interface.processor.ts";

const serviceLogger = appLogger.namespace("BalanceKafkaProcessor");

type DeleteArgType = {
  transactionHash: Hash;
  transferHash: Hash;
};
type CreateArgType = [BalanceHistoryCreateInput, BalanceHistoryCreateInput];

export class BalanceKafkaProcessor
  implements
    InterfaceProcessor<
      Hash,
      TransferDto,
      Promise<CreateArgType>,
      void,
      DeleteArgType,
      CreateArgType
    >
{
  async get(id: Hash): Promise<TransferDto> {
    const transfer = await getTransfer(id);
    if (transfer == null) {
      throw new NoGetResult(id);
    }
    return transfer;
  }

  async toInput(
    transfer: TransferDto,
  ): Promise<[BalanceHistoryCreateInput, BalanceHistoryCreateInput]> {
    const { from, to, tokenAddress, amount } = transfer;
    /** handle "from" address **/
    // get latest snapshot
    const latestFromBalanceHistory = await getLatestBalanceHistory(
      from,
      tokenAddress,
    );
    const latestToBalanceHistory = await getLatestBalanceHistory(
      to,
      tokenAddress,
    );
    const fromBalanceHistoryIndex = latestFromBalanceHistory?.index ?? 0;
    const toBalanceHistoryIndex = latestToBalanceHistory?.index ?? 0;

    const fromCurrentAmount: bigint = latestFromBalanceHistory?.amount ?? 0n;
    const toCurrentAmount: bigint = latestToBalanceHistory?.amount ?? 0n;
    return [
      {
        hash: `${transfer.transactionHash}-${transfer.hash}-${from}`,
        blockNumber: transfer.blockNumber,
        transactionIndex: transfer.transactionIndex,
        logIndex: transfer.logIndex,
        index: fromBalanceHistoryIndex + 1,
        transferHash: transfer.hash,
        transactionHash: transfer.transactionHash,
        address: from,
        tokenAddress: tokenAddress,
        amount: (fromCurrentAmount - amount).toString(),
        createdAt: transfer.timestamp,
      },
      {
        hash: `${transfer.transactionHash}-${transfer.hash}-${to}`,
        blockNumber: transfer.blockNumber,
        transactionIndex: transfer.transactionIndex,
        logIndex: transfer.logIndex,
        index: toBalanceHistoryIndex + 1,
        transferHash: transfer.hash,
        transactionHash: transfer.transactionHash,
        address: to,
        tokenAddress: tokenAddress,
        amount: (toCurrentAmount + amount).toString(),
        createdAt: transfer.timestamp,
      },
    ];
  }

  async deleteFromDb({
    transactionHash,
    transferHash,
  }: DeleteArgType): Promise<void> {
    await deleteBalanceHistory(transactionHash, transferHash);
  }

  async createInDb(
    inputs: [BalanceHistoryCreateInput, BalanceHistoryCreateInput],
  ): Promise<void> {
    await createBalanceHistories(inputs);
  }

  async process(id: Hash): Promise<void> {
    serviceLogger.info("processing: " + id);

    const obj = await this.get(id);

    const input = await this.toInput(obj);

    if (!input) {
      throw Error("[BalanceKafkaProcessor] input is null");
    }

    await this.deleteFromDb({
      transactionHash: obj.transactionHash,
      transferHash: obj.hash,
    });
    serviceLogger.info(`deleted ${id}`);
    await this.createInDb(input);
    serviceLogger.info(`created ${id}`);
  }
}
