import type { SwapDto, TransactionDto } from "@database/dto.ts";
import { type Account, type Hash, isHash } from "viem";

import { appLogger } from "../monitor/app.logger.ts";
import { AbstractInjectLogger } from "../queues/kafka/inject-logger.abstract.ts";
import { CopyTradeMessagePayload } from "../queues/kafka/producers";

export type CopyTradingExecuteParams = {
  copyContractAddress: Hash;
  account: Account;
  swap: SwapDto;
  transaction: TransactionDto;
};

export abstract class CopyTradingDEX extends AbstractInjectLogger {
  protected readonly dexAddress: Hash;

  constructor() {
    super({
      logger: appLogger.namespace(CopyTradingDEX.name),
    });

    {
      const dexAddress = process.env.BERA_DEX_ADDRESS;
      if (!dexAddress) {
        throw new Error("BERA_DEX_ADDRESS is not set");
      }
      if (!isHash(dexAddress)) {
        throw new Error("BERA_DEX_ADDRESS is not a valid hash");
      }
      this.dexAddress = dexAddress;
    }
  }

  public abstract execute(
    params: CopyTradingExecuteParams,
  ): Promise<CopyTradeMessagePayload>;
}
