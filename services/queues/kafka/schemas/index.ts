import { readAVSCAsync } from "@kafkajs/confluent-schema-registry";
import { join } from "path";

export const blockSchema = await readAVSCAsync(
  join(import.meta.dir, "block.schema.avsc"),
);

export const logSchema = await readAVSCAsync(
  join(import.meta.dir, "log.schema.avsc"),
);

export const swapSchema = await readAVSCAsync(
  join(import.meta.dir, "swap.schema.avsc"),
);

export const transactionSchema = await readAVSCAsync(
  join(import.meta.dir, "transaction.schema.avsc"),
);

export const transferSchema = await readAVSCAsync(
  join(import.meta.dir, "transfer.schema.avsc"),
);
