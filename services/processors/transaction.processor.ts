import {
  createTransaction,
  deleteTransaction,
  type TransactionCreateInput,
} from "@database/repositories/transaction.repository.ts";
import { toTransactionCreateInput } from "@database/repositories/utils.ts";
import type { GetTransactionReturnType, Hash } from "viem";

import { getTransaction } from "../data-source";
import logger from "../monitor/logger.ts";
import type { InterfaceProcessor } from "./interface.processor.ts";

export class TransactionProcessor
  implements
    InterfaceProcessor<
      Hash,
      GetTransactionReturnType,
      TransactionCreateInput | null
    >
{
  get(id: Hash): Promise<GetTransactionReturnType> {
    return getTransaction(id);
  }

  toInput(input: GetTransactionReturnType): TransactionCreateInput | null {
    return toTransactionCreateInput(input);
  }

  async deleteFromDb(id: Hash): Promise<void> {
    await deleteTransaction(id);
  }

  async createInDb(input: TransactionCreateInput): Promise<void> {
    await createTransaction(input);
  }

  async process(id: Hash): Promise<void> {
    logger.info("[TransactionProcessor] processing: " + id);

    const obj = await this.get(id);

    const input = this.toInput(obj);

    if (!input) {
      throw Error("[TransactionProcessor] input is null");
    }

    await this.deleteFromDb(id);
    logger.info(`[TransactionProcessor] deleted ${id}`);
    await this.createInDb(input);
    logger.info(`[TransactionProcessor] created ${id}`);
  }
}
