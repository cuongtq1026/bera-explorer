import { IsNotEmpty } from "class-validator";

import { topics } from "../index.ts";
import kafkaConnection, {
  type TransactionOptions,
} from "../kafka.connection.ts";

export class LogMessagePayload {
  @IsNotEmpty()
  logHash: string;
}

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
