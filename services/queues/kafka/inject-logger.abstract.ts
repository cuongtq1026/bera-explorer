import type { AppLogger } from "../../monitor/app.logger.ts";

export abstract class AbstractInjectLogger {
  protected serviceLogger: AppLogger;

  protected constructor(options: { logger: AppLogger }) {
    this.serviceLogger = options.logger;
  }
}
