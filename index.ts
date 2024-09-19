import { getBlock } from "./services/data-source";
import {
  createBlock,
  deleteBlock,
} from "./services/data-storage/database/repositories/block.repository.ts";
import { toBlockCreateInput } from "./services/data-storage/database/repositories/utils.ts";

async function start() {
  const block = await getBlock(0n);

  if (block == null) {
    console.error("Block is null");
    return;
  }

  const createBlockInput = toBlockCreateInput(block);

  if (!createBlockInput) {
    console.error("createBlockInput is null");
    return;
  }

  await deleteBlock(createBlockInput.number);
  console.log("block deleted");
  await createBlock(createBlockInput);
  console.log("block created", createBlockInput);
}

start();
