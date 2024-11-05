import JSONBigint from "json-bigint";

import { queues } from "../config";
import { appLogger } from "../monitor/app.logger.ts";
import { AbstractInjectLogger } from "../queues/kafka/inject-logger.abstract.ts";
import kafkaConnection from "../queues/kafka/kafka.connection.ts";
import { sendToBlockTopic } from "../queues/kafka/producers/block.kafka.producer.ts";
import { queueBlock } from "../queues/rabbitmq/producers";
import rabbitmqConnection from "../queues/rabbitmq/rabbitmq.connection.ts";
import { parseToBigInt, wait } from "../utils.ts";

export class BlockSchedule extends AbstractInjectLogger {
  private readonly maxBlockWaiting: number = 10;

  constructor() {
    super({
      logger: appLogger.namespace(BlockSchedule.name),
    });

    if (process.env.MAX_BLOCK_WAITING) {
      this.maxBlockWaiting = +process.env.MAX_BLOCK_WAITING;
    }
  }

  async run() {
    while (true) {
      await this.execute();

      await wait(1000);
    }
  }

  public async execute(): Promise<void> {
    const checkQueueResult = await rabbitmqConnection.checkQueue(
      queues.BLOCK_QUEUE.name,
    );
    const { messageCount } = checkQueueResult;
    const numberOfBlocksToSend = this.maxBlockWaiting - messageCount;
    if (numberOfBlocksToSend <= 0) {
      this.serviceLogger.debug(
        `Reached max block waiting: ${this.maxBlockWaiting}.`,
      );
      return;
    }
    // get latest block from kafka
    const latestMessage = await kafkaConnection.consumeLatestMessage("BLOCK");
    this.serviceLogger.info(
      "latestMessage: " + JSONBigint.stringify(latestMessage),
    );
    const latestBlock = parseToBigInt(latestMessage.blockNumber);

    for (let i = 0; i < numberOfBlocksToSend; i++) {
      const newBlockNumber = latestBlock + BigInt(i + 1);
      await queueBlock(newBlockNumber);
      await sendToBlockTopic([
        {
          blockNumber: newBlockNumber.toString(),
        },
      ]);

      this.serviceLogger.info(
        `Send ${newBlockNumber} to block topic and block queue.`,
      );
    }
  }
}
