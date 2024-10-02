import {
  type BlockCreateInput,
  createBlock,
  deleteBlock,
} from "@database/repositories/block.repository.ts";
import { toBlockCreateInput } from "@database/repositories/utils.ts";
import type { Block, Hash } from "viem";

import { getBlock } from "../data-source";
import logger from "../monitor/logger.ts";
import type { InterfaceProcessor } from "./interface.processor.ts";

export class BlockProcessor
  implements
    InterfaceProcessor<
      bigint,
      Block,
      BlockCreateInput | null,
      {
        transactions: Hash[];
      }
    >
{
  get(id: bigint): Promise<Block> {
    return getBlock(id);
  }

  toInput(input: Block): BlockCreateInput | null {
    return toBlockCreateInput(input);
  }

  async deleteFromDb(id: bigint): Promise<void> {
    await deleteBlock(id);
  }

  async createInDb(input: BlockCreateInput): Promise<void> {
    await createBlock(input);
  }

  async process(id: bigint): Promise<{ transactions: Hash[] }> {
    logger.info("[BlockProcessor] processing: " + id);

    const block = await this.get(id);

    const input = this.toInput(block);

    if (!input) {
      throw Error("[BlockProcessor] input is null");
    }

    await this.deleteFromDb(id);
    logger.info(`[BlockProcessor] deleted ${id}`);
    await this.createInDb(input);
    logger.info(`[BlockProcessor] created ${id}`);

    return {
      transactions: block.transactions as Hash[],
    };
  }
}
