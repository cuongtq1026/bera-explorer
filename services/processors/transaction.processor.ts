import {
  createTransaction,
  deleteTransaction,
  type TransactionCreateInput,
} from "@database/repositories/transaction.repository.ts";
import { toTransactionCreateInput } from "@database/repositories/utils.ts";
import type { GetTransactionReturnType, Hash } from "viem";

import { getTransaction } from "../data-source";
import { appLogger } from "../monitor/app.logger.ts";
import type { InterfaceProcessor } from "./interface.processor.ts";

const serviceLogger = appLogger.namespace("TransactionProcessor");

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
    serviceLogger.info("processing: " + id);

    const obj = await this.get(id);

    const input = this.toInput(obj);

    if (!input) {
      throw Error("[TransactionProcessor] input is null");
    }

    await this.deleteFromDb(id);
    serviceLogger.info(`deleted ${id}`);
    await this.createInDb(input);
    serviceLogger.info(`created ${id}`);
  }
}
