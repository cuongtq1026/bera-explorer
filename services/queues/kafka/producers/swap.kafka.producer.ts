import { IsNotEmpty } from "class-validator";

import { topics } from "../index.ts";
import kafkaConnection, {
  type TransactionOptions,
} from "../kafka.connection.ts";

export class SwapMessagePayload {
  @IsNotEmpty()
  swapId: string;
}

export async function sendToSwapTopic(
  messages: SwapMessagePayload[],
  options?: TransactionOptions,
) {
  return kafkaConnection.send(
    topics.SWAP.name,
    await Promise.all(
      messages.map(async (message) => ({
        value: await kafkaConnection.encode("LOG", message),
      })),
    ),
    options,
  );
}
