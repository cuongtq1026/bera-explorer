type QueueType = {
  name: string;
  routingKey: string;
};

export const queues = {
  BLOCK_QUEUE: {
    name: "blocks",
    routingKey: "crawler.block",
  } as QueueType,
  TRANSACTION_QUEUE: {
    name: "transactions",
    routingKey: "crawler.transaction",
  } as QueueType,
  TRANSACTION_RECEIPT_QUEUE: {
    name: "transaction_receipts",
    routingKey: "crawler.transaction_receipt",
  } as QueueType,
  INTERNAL_TRANSACTION_QUEUE: {
    name: "internal_transactions",
    routingKey: "crawler.internal_transaction",
  } as QueueType,
};

export const DEAD_LETTER_EXCHANGE_NAME = "dead-letter";
export const DEAD_LETTER_QUEUE_NAME = "dead-letter-queue";
