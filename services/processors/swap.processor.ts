import { dtoToSwapCreateInput, type TransactionDto } from "@database/dto.ts";
import {
  createSwaps,
  deleteSwaps,
  type SwapCreateInput,
} from "@database/repositories/swap.repository.ts";
import { findTransaction } from "@database/repositories/transaction.repository.ts";
import type { InterfaceProcessor } from "@processors/interface.processor.ts";
import { type Hash } from "viem";

import { getDecoder } from "../decoder";
import { NoGetResult } from "../exceptions/processor.exception.ts";
import logger from "../monitor/logger.ts";
import { getSignature } from "../utils.ts";

type CreateArgType = SwapCreateInput[];
type InputType = Promise<CreateArgType | null>;

export class SwapProcessor
  implements
    InterfaceProcessor<
      Hash,
      TransactionDto,
      InputType,
      void,
      Hash,
      CreateArgType
    >
{
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
    const signature = getSignature(transactionDto.input);
    const decoder = getDecoder(signature);
    if (decoder == null) {
      return null;
    }

    return decoder
      .decodeSwaps(transactionDto)
      .map((swapDto) => dtoToSwapCreateInput(swapDto));
  }

  async deleteFromDb(transactionHash: Hash): Promise<void> {
    await deleteSwaps(transactionHash);
  }

  async createInDb(inputs: SwapCreateInput[]): Promise<void> {
    await createSwaps(inputs);
  }

  async process(transactionHash: Hash) {
    // get
    const transaction = await this.get(transactionHash);

    const input = await this.toInput(transaction);
    if (input == null) {
      // consider it finished
      return;
    }

    // store to database
    await this.deleteFromDb(transactionHash);
    logger.info(`[SwapProcessor] deleted ${transactionHash}`);
    await this.createInDb(input);
    logger.info(`[SwapProcessor] created ${transactionHash}`);
    return;
  }
}
