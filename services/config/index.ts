export const crawlerExchangeName = "crawler";
export const aggregatorExchangeName = "aggregator";

type QueueType = {
  name: string;
  routingKey: string;
  bindExchangeName: typeof crawlerExchangeName | typeof aggregatorExchangeName;
};

export const queues = {
  // Crawler exchange
  BLOCK_QUEUE: {
    name: "blocks",
    routingKey: "crawler.block",
    bindExchangeName: crawlerExchangeName,
  } as QueueType,
  TRANSACTION_QUEUE: {
    name: "transactions",
    routingKey: "crawler.transaction",
    bindExchangeName: crawlerExchangeName,
  } as QueueType,
  TRANSACTION_RECEIPT_QUEUE: {
    name: "transaction_receipts",
    routingKey: "crawler.transaction_receipt",
    bindExchangeName: crawlerExchangeName,
  } as QueueType,
  INTERNAL_TRANSACTION_QUEUE: {
    name: "internal_transactions",
    routingKey: "crawler.internal_transaction",
    bindExchangeName: crawlerExchangeName,
  } as QueueType,

  // Aggregator exchange
  TRANSFER: {
    name: "transfer",
    routingKey: "aggregator.transfer",
    bindExchangeName: aggregatorExchangeName,
  } as QueueType,
};

export const AGGREGATOR_TRANSACTION_ROUTING_KEY = "aggregator.transaction";
export const DEAD_LETTER_EXCHANGE_NAME = "dead-letter";
export const DEAD_LETTER_QUEUE_NAME = "dead-letter-queue";
