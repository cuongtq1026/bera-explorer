import { topics } from "../index.ts";
import kafkaConnection, {
  type TransactionOptions,
} from "../kafka.connection.ts";
import type { TransactionMessagePayload } from "./index.ts";

export async function sendToTransactionTopic(
  messages: TransactionMessagePayload[],
  options?: TransactionOptions,
) {
  return kafkaConnection.send(
    topics.TRANSACTION.name,
    await Promise.all(
      messages.map(async (message) => ({
        value: await kafkaConnection.encode("TRANSACTION", message),
      })),
    ),
    options,
  );
}
