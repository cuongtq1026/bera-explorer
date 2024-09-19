export type LogCreateInput = {
  logHash: string;
  address: string;
  data: string;
  blockNumber: bigint | number;
  transactionHash: string;
  transactionIndex: number;
  index: number;
  removed: boolean;

  topics: LogTopicCreateInput[];
};

export type LogTopicCreateInput = {
  topicHash: string;
  topic: string;
  index: number;
};
