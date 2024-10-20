import { IsNotEmpty } from "class-validator";

import { topics } from "../index.ts";
import kafkaConnection, {
  type TransactionOptions,
} from "../kafka.connection.ts";

export class TransferMessagePayload {
  @IsNotEmpty()
  transferHash: string;
}

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
