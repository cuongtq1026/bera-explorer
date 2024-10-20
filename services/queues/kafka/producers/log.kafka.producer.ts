import { topics } from "../index.ts";
import kafkaConnection, {
  type TransactionOptions,
} from "../kafka.connection.ts";
import type { LogMessagePayload } from "./index.ts";

export async function sendToLogTopic(
  messages: LogMessagePayload[],
  options?: TransactionOptions,
) {
  return kafkaConnection.send(
    topics.LOG.name,
    await Promise.all(
      messages.map(async (message) => ({
        value: await kafkaConnection.encode("LOG", message),
      })),
    ),
    options,
  );
}
