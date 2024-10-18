import {
  BlockMessagePayload,
  LogMessagePayload,
  SwapMessagePayload,
  topics,
  TransactionMessagePayload,
  TransferMessagePayload,
} from "../index.ts";
import kafkaConnection from "../kafka.connection.ts";

export async function sendToBlockTopic(messages: BlockMessagePayload[]) {
  return kafkaConnection.send(
    topics.BLOCK.name,
    await Promise.all(
      messages.map(async (message) => ({
        value: await kafkaConnection.encode("BLOCK", message),
      })),
    ),
  );
}

export async function sendToTransactionTopic(
  messages: TransactionMessagePayload[],
) {
  return kafkaConnection.send(
    topics.TRANSACTION.name,
    await Promise.all(
      messages.map(async (message) => ({
        value: await kafkaConnection.encode("TRANSACTION", message),
      })),
    ),
  );
}

export async function sendToTransferTopic(messages: TransferMessagePayload[]) {
  return kafkaConnection.send(
    topics.TRANSFER.name,
    await Promise.all(
      messages.map(async (message) => ({
        value: await kafkaConnection.encode("TRANSFER", message),
      })),
    ),
  );
}

export async function sendToLogTopic(messages: LogMessagePayload[]) {
  return kafkaConnection.send(
    topics.LOG.name,
    await Promise.all(
      messages.map(async (message) => ({
        value: await kafkaConnection.encode("LOG", message),
      })),
    ),
  );
}

export async function sendToSwapTopic(messages: SwapMessagePayload[]) {
  return kafkaConnection.send(
    topics.SWAP.name,
    await Promise.all(
      messages.map(async (message) => ({
        value: await kafkaConnection.encode("LOG", message),
      })),
    ),
  );
}
