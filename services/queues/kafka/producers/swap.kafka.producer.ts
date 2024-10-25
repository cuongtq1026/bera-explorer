import { topics } from "../index.ts";
import kafkaConnection, {
  type TransactionOptions,
} from "../kafka.connection.ts";
import type { SwapMessagePayload } from "./index.ts";

export async function sendToSwapTopic(
  messages: SwapMessagePayload[],
  options?: TransactionOptions,
) {
  return kafkaConnection.send(
    topics.SWAP.name,
    await Promise.all(
      messages.map(async (message) => ({
        value: await kafkaConnection.encode("SWAP", message),
      })),
    ),
    options,
  );
}
