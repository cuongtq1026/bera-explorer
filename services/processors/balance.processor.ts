import { type TransferDto } from "@database/dto.ts";
import {
  type BalanceCreateInput,
  createBalances,
  deleteBalance,
} from "@database/repositories/balance.repository.ts";
import {
  findTransfers,
  getTransfer,
} from "@database/repositories/transfer.repository.ts";
import { isAddress } from "viem";

import { InvalidPayloadException } from "../exceptions/consumer.exception.ts";
import { NoGetResult } from "../exceptions/processor.exception.ts";
import logger from "../monitor/logger.ts";
import type { InterfaceProcessor } from "./interface.processor.ts";

export class BalanceProcessor
  implements
    InterfaceProcessor<
      string,
      TransferDto,
      Promise<BalanceCreateInput[]>,
      void,
      string,
      BalanceCreateInput[]
    >
{
  async get(id: string): Promise<TransferDto> {
    const transfer = await getTransfer(id);
    if (!transfer) {
      throw new NoGetResult(id);
    }
    return transfer;
  }

  async toInput(transferDto: TransferDto): Promise<BalanceCreateInput[]> {
    // build sender balance
    const { from: sender, to: receiver } = transferDto;

    logger.info(`[BalanceProcessor] Building sender balance for ${sender}`);
    const senderTransfers = await findTransfers({
      address: sender,
    });
    // TODO: Handle pagination
    const senderBalanceMap = new Map<string, bigint>();
    senderTransfers.forEach((transfer) => {
      const { tokenAddress, from, amount } = transfer;
      if (!senderBalanceMap.get(tokenAddress)) {
        senderBalanceMap.set(tokenAddress, 0n);
      }
      const currentBalance = senderBalanceMap.get(tokenAddress)!;
      const isSentTx = from === sender;
      const newBalance = isSentTx
        ? currentBalance - amount
        : currentBalance + amount;

      senderBalanceMap.set(tokenAddress, newBalance);
    });

    // build receiver balance
    logger.info(`[BalanceProcessor] Building receiver balance for ${receiver}`);
    const receiverTransfers = await findTransfers({
      address: receiver,
    });
    const receiverBalanceMap = new Map<string, bigint>();
    receiverTransfers.forEach((transfer) => {
      const { tokenAddress, from, amount } = transfer;
      if (!receiverBalanceMap.get(tokenAddress)) {
        receiverBalanceMap.set(tokenAddress, 0n);
      }
      const currentBalance = receiverBalanceMap.get(tokenAddress)!;
      const isSentTx = from === receiver;
      const newBalance = isSentTx
        ? currentBalance - amount
        : currentBalance + amount;

      receiverBalanceMap.set(tokenAddress, newBalance);
    });

    const balanceCreateInputs: BalanceCreateInput[] = [];
    senderBalanceMap.forEach((balance, tokenAddress) => {
      balanceCreateInputs.push({
        transferHash: transferDto.hash,
        address: sender,
        tokenAddress,
        amount: balance.toString(),
      });
    });
    receiverBalanceMap.forEach((balance, tokenAddress) => {
      balanceCreateInputs.push({
        transferHash: transferDto.hash,
        address: receiver,
        tokenAddress,
        amount: balance.toString(),
      });
    });

    logger.info(
      `[BalanceProcessor] Total balance create inputs ${balanceCreateInputs.length}`,
    );
    return balanceCreateInputs;
  }

  async deleteFromDb(address: string): Promise<void> {
    if (!isAddress(address)) {
      throw new InvalidPayloadException(
        `[BalanceProcessor] ${address} is not a valid address.`,
      );
    }
    await deleteBalance(address);
  }

  async createInDb(inputs: BalanceCreateInput[]): Promise<void> {
    await createBalances(inputs);
  }

  async process(transferHash: string): Promise<void> {
    logger.info("[BalanceProcessor] processing: " + transferHash);

    const transferDto = await this.get(transferHash);

    const inputs = await this.toInput(transferDto);

    if (!inputs) {
      throw Error("[BalanceProcessor] input is null");
    }

    await this.deleteFromDb(transferDto.from);
    logger.info(`[BalanceProcessor] deleted ${transferDto.from}`);
    await this.deleteFromDb(transferDto.to);
    logger.info(`[BalanceProcessor] deleted ${transferDto.to}`);
    await this.createInDb(inputs);
    logger.info(`[BalanceProcessor] created ${transferHash}`);
  }
}
