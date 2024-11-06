import { appLogger } from "../monitor/app.logger.ts";
import { AbstractInjectLogger } from "../queues/kafka/inject-logger.abstract.ts";
import { CopyTradeKafkaStream } from "../queues/kafka/streams/copy-trade.kafka.stream.ts";

export class CopyTrading extends AbstractInjectLogger {
  constructor() {
    super({
      logger: appLogger.namespace(CopyTrading.name),
    });
  }

  async start() {
    const stream = new CopyTradeKafkaStream();

    await stream.start();
  }
}
