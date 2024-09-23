type QueueType = {
  name: string;
  routingKey: string;
};

export const queues: { [key: string]: QueueType } = {
  BLOCK_QUEUE: {
    name: "blocks",
    routingKey: "crawler.block",
  },
};

export const DEAD_LETTER_EXCHANGE_NAME = "dead-letter";
export const DEAD_LETTER_QUEUE_NAME = "dead-letter-queue";
