import {
  type BlockCreateInput,
  createBlock,
  deleteBlock,
} from "@database/repositories/block.repository.ts";
import { toBlockCreateInput } from "@database/repositories/utils.ts";
import type { Block, Hash } from "viem";

import { getBlock } from "../data-source";
import { appLogger } from "../monitor/app.logger.ts";
import { AbstractProcessor } from "./abstract.processor.ts";

const serviceLogger = appLogger.namespace("BlockProcessor");

export class BlockProcessor extends AbstractProcessor<
  bigint,
  Block,
  BlockCreateInput | null,
  {
    transactions: Hash[];
  }
> {
  constructor() {
    super({
      logger: appLogger.namespace(BlockProcessor.name),
    });
  }

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
    serviceLogger.info("processing: " + id);

    const block = await this.get(id);

    const input = this.toInput(block);

    if (!input) {
      throw Error("[BlockProcessor] input is null");
    }

    await this.deleteFromDb(id);
    serviceLogger.info(`deleted ${id}`);
    await this.createInDb(input);
    serviceLogger.info(`created ${id}`);

    return {
      transactions: block.transactions as Hash[],
    };
  }
}
