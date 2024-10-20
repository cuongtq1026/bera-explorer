import { IsNotEmpty } from "class-validator";

import { topics } from "../index.ts";
import kafkaConnection, {
  type TransactionOptions,
} from "../kafka.connection.ts";

export class TransactionMessagePayload {
  @IsNotEmpty()
  hash: string;
}

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
