import {
  BlockMessagePayload,
  LogMessagePayload,
  SwapMessagePayload,
  topics,
  TransactionMessagePayload,
  TransferMessagePayload,
} from "../index.ts";
import kafkaConnection, {
  type TransactionOptions,
} from "../kafka.connection.ts";

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
