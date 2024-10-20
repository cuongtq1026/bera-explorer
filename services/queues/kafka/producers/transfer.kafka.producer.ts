import { topics } from "../index.ts";
import kafkaConnection, {
  type TransactionOptions,
} from "../kafka.connection.ts";
import type { TransferMessagePayload } from "./index.ts";

export async function sendToTransferTopic(
  messages: TransferMessagePayload[],
  options?: TransactionOptions,
) {
  return kafkaConnection.send(
    topics.TRANSFER.name,
    await Promise.all(
      messages.map(async (message) => ({
        value: await kafkaConnection.encode("TRANSFER", message),
      })),
    ),
    options,
  );
}
