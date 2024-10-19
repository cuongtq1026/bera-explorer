import { readAVSCAsync } from "@kafkajs/confluent-schema-registry";
import { join } from "path";

export const blockSchema = await readAVSCAsync(
  join(import.meta.dirname, "block.schema.avsc"),
);

export const logSchema = await readAVSCAsync(
  join(import.meta.dirname, "log.schema.avsc"),
);

export const swapSchema = await readAVSCAsync(
  join(import.meta.dirname, "swap.schema.avsc"),
);

export const transactionSchema = await readAVSCAsync(
  join(import.meta.dirname, "transaction.schema.avsc"),
);

export const transferSchema = await readAVSCAsync(
  join(import.meta.dirname, "transfer.schema.avsc"),
);
