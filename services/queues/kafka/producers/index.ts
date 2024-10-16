import {
  BalanceMessagePayload,
  BlockMessagePayload,
  LogMessagePayload,
  topics,
  TransactionMessagePayload,
  TransferMessagePayload,
} from "../index.ts";
import kafkaConnection from "../kafka.connection.ts";

export async function sendToBalanceTopic(transferHash: string) {
  return kafkaConnection.send(topics.BALANCE.name, [
    {
      value: JSON.stringify({
        transferHash,
      } as BalanceMessagePayload),
    },
  ]);
}

export async function sendToBlockTopic(blockNumber: number) {
  return kafkaConnection.send(topics.BALANCE.name, [
    {
      value: JSON.stringify({
        blockNumber,
      } as BlockMessagePayload),
    },
  ]);
}

export async function sendToTransactionTopic(transactionHashes: string[]) {
  return kafkaConnection.send(
    topics.TRANSACTION.name,
    transactionHashes.map((transactionHash) => ({
      value: JSON.stringify({
        hash: transactionHash,
      } as TransactionMessagePayload),
    })),
  );
}

export async function sendToTransferTopic(transferHashes: string[]) {
  return kafkaConnection.send(
    topics.TRANSFER.name,
    transferHashes.map((transferHash) => ({
      value: JSON.stringify({
        transferHash,
      } as TransferMessagePayload),
    })),
  );
}

export async function sendToLogTopic(logHashes: string[]) {
  return kafkaConnection.send(
    topics.LOG.name,
    logHashes.map((logHash) => ({
      value: JSON.stringify({
        logHash,
      } as LogMessagePayload),
    })),
  );
}
