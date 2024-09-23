import { IsNotEmpty } from "class-validator";

import { queues } from "../../config";
import mqConnection from "../rabbitmq.connection.ts";

export class QueueBlockPayload {
  @IsNotEmpty()
  blockNumber: string;
}

export async function queueBlock(blockNumber: bigint) {
  await mqConnection.publishToCrawlerExchange(queues.BLOCK_QUEUE.routingKey, {
    blockNumber: String(blockNumber),
  } as QueueBlockPayload);

  console.log(
    `[Block ${blockNumber}] Queued to ${queues.BLOCK_QUEUE.routingKey} key`,
  );
}
