import {
  createTransactionReceipt,
  deleteTransactionReceipt,
  type TransactionReceiptCreateInput,
} from "@database/repositories/transaction-receipt.repository.ts";
import { toTransactionReceiptCreateInput } from "@database/repositories/utils.ts";
import type { GetTransactionReceiptReturnType, Hash } from "viem";

import { getTransactionReceipt } from "../data-source";
import logger from "../monitor/logger.ts";
import type { InterfaceProcessor } from "./interface.processor.ts";

export class TransactionReceiptProcessor
  implements
    InterfaceProcessor<
      Hash,
      GetTransactionReceiptReturnType,
      TransactionReceiptCreateInput,
      void
    >
{
  get(id: Hash): Promise<GetTransactionReceiptReturnType> {
    return getTransactionReceipt(id);
  }

  toInput(
    input: GetTransactionReceiptReturnType,
  ): TransactionReceiptCreateInput | null {
    return toTransactionReceiptCreateInput(input);
  }

  async deleteFromDb(id: Hash): Promise<void> {
    await deleteTransactionReceipt(id);
  }

  async createInDb(input: TransactionReceiptCreateInput): Promise<void> {
    await createTransactionReceipt(input);
  }

  async process(id: Hash): Promise<void> {
    logger.info("[TransactionReceiptProcessor] processing: " + id);

    const obj = await this.get(id);

    const input = this.toInput(obj);

    if (!input) {
      throw Error("[TransactionReceiptProcessor] input is null");
    }

    await this.deleteFromDb(id);
    logger.info(`[TransactionReceiptProcessor] deleted ${id}`);
    await this.createInDb(input);
    logger.info(`[TransactionReceiptProcessor] created ${id}`);
  }
}
