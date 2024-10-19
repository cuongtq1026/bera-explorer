import { AppLogger } from "./app.logger.ts";

export class KafkaLogger extends AppLogger {
  constructor() {
    super({ namespace: "KafkaJS" });
  }
}
