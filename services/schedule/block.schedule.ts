import JSONBigint from "json-bigint";
import nodeCron from "node-cron";

import { queues } from "../config";
import { appLogger } from "../monitor/app.logger.ts";
import { AbstractInjectLogger } from "../queues/kafka/inject-logger.abstract.ts";
import kafkaConnection from "../queues/kafka/kafka.connection.ts";
import rabbitmqConnection from "../queues/rabbitmq/rabbitmq.connection.ts";

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

  run() {
    nodeCron.schedule(
      "*/1 * * * * *",
      async () => {
        await this.execute();
      },
      {
        runOnInit: true,
      },
    );
  }

  public async execute(): Promise<void> {
    const checkQueueResult = await rabbitmqConnection.checkQueue(
      queues.BLOCK_QUEUE.name,
    );
    const { messageCount } = checkQueueResult;
    if (messageCount >= this.maxBlockWaiting) {
      return;
    }
    // get latest block from kafka
    const latestMessage = await kafkaConnection.consumeLatestMessage("BLOCK");
    this.serviceLogger.info(
      "latestMessage: " + JSONBigint.stringify(latestMessage),
    );
  }
}
