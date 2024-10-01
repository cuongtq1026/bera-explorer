import {
  createInternalTransaction,
  deleteInternalTransaction,
  type InternalTransactionCreateInput,
} from "@database/repositories/internal-transaction.repository.ts";
import { toInternalTransactionCreateInput } from "@database/repositories/utils.ts";
import type { Hash } from "viem";

import { getAllTracerCallsTransaction } from "../data-source";
import type { TraceCallNested } from "../data-source/rpc-request/types.ts";
import logger from "../monitor/logger.ts";
import type { InterfaceProcessor } from "./interface.processor.ts";

type ToInputArgType = {
  id: Hash;
  obj: TraceCallNested;
};

export class InternalTransactionProcessor
  implements
    InterfaceProcessor<
      Hash,
      ToInputArgType,
      InternalTransactionCreateInput,
      void
    >
{
  async get(id: Hash): Promise<ToInputArgType> {
    return {
      id,
      obj: await getAllTracerCallsTransaction(id),
    };
  }

  toInput(input: ToInputArgType): InternalTransactionCreateInput | null {
    return toInternalTransactionCreateInput(input.id, null, 0, input.obj);
  }

  async deleteFromDb(id: Hash): Promise<void> {
    await deleteInternalTransaction(id);
  }

  async createInDb(input: InternalTransactionCreateInput): Promise<void> {
    await createInternalTransaction(input);
  }

  async process(id: Hash): Promise<void> {
    logger.info("[InternalTransactionProcessor] processing: " + id);

    const obj = await this.get(id);

    const input = this.toInput(obj);

    if (!input) {
      throw Error("[InternalTransactionProcessor] input is null");
    }

    await this.deleteFromDb(id);
    logger.info(`[InternalTransactionProcessor] deleted ${id}`);
    await this.createInDb(input);
    logger.info(`[InternalTransactionProcessor] created ${id}`);
  }
}