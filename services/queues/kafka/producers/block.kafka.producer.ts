import { IsNotEmpty } from "class-validator";

import { topics } from "../index.ts";
import kafkaConnection, {
  type TransactionOptions,
} from "../kafka.connection.ts";

export class BlockMessagePayload {
  @IsNotEmpty()
  blockNumber: string;
}

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
