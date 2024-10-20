import { topics } from "../index.ts";
import kafkaConnection, {
  type TransactionOptions,
} from "../kafka.connection.ts";
import type { BlockMessagePayload } from "./index.ts";

export async function sendToBlockTopic(
  messages: BlockMessagePayload[],
  options?: TransactionOptions,
) {
  return kafkaConnection.send(
    topics.BLOCK.name,
    await Promise.all(
      messages.map(async (message) => ({
        value: await kafkaConnection.encode("BLOCK", message),
      })),
    ),
    options,
  );
}
