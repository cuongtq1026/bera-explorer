import { dtoToSwapCreateInput, type TransactionDto } from "@database/dto.ts";
import {
  createAllSwapChildren,
  deleteSwaps,
  type SwapCreateChildrenInput,
} from "@database/repositories/swap.repository.ts";
import { findTransaction } from "@database/repositories/transaction.repository.ts";
import { AbstractProcessor } from "@processors/abstract.processor.ts";
import { type Hash } from "viem";

import { getDecoder } from "../decoder";
import { NoGetResult } from "../exceptions/processor.exception.ts";
import { appLogger } from "../monitor/app.logger.ts";
import { getSignature } from "../utils.ts";

type CreateArgType = {
  transactionHash: Hash;
  inputs: SwapCreateChildrenInput[];
};
type CreateReturnType = string[];
type InputType = Promise<CreateArgType | null>;

export class SwapProcessor extends AbstractProcessor<
  Hash,
  TransactionDto,
  InputType,
  CreateReturnType | null,
  Hash,
  CreateArgType,
  void,
  CreateReturnType
> {
  constructor() {
    super({
      logger: appLogger.namespace(SwapProcessor.name),
    });
  }

  async get(transactionHash: Hash): Promise<TransactionDto> {
    const transaction = await findTransaction(transactionHash as Hash, {
      withReceipt: true,
    });
    if (!transaction) {
      throw new NoGetResult(transactionHash);
    }
    return transaction;
  }

  async toInput(transactionDto: TransactionDto): InputType {
    try {
      const signature = getSignature(transactionDto.input);
      const decoder = getDecoder(signature);
      if (decoder == null) {
        return null;
      }

      return {
        transactionHash: transactionDto.hash,
        inputs: decoder
          .decodeSwaps(transactionDto)
          .map((swapDto) => dtoToSwapCreateInput(swapDto)),
      };
    } catch (e: unknown) {
      if (e instanceof Error) {
        this.serviceLogger.error(
          `Failed on create input: ${transactionDto.hash}`,
        );
      }

      throw e;
    }
  }

  async deleteFromDb(transactionHash: Hash): Promise<void> {
    await deleteSwaps(transactionHash);
  }

  async createInDb(args: CreateArgType): Promise<string[]> {
    return createAllSwapChildren(args.transactionHash, args.inputs);
  }

  async process(transactionHash: Hash): Promise<string[] | null> {
    // get
    const transaction = await this.get(transactionHash);

    const input = await this.toInput(transaction);
    if (input == null) {
      // consider it finished
      return null;
    }

    // store to database
    await this.deleteFromDb(transactionHash);
    this.serviceLogger.info(`deleted ${transactionHash}`);
    const swapHashes = await this.createInDb(input);
    this.serviceLogger.info(`created ${transactionHash}`);
    return swapHashes;
  }
}
