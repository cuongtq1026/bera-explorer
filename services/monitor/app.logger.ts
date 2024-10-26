import type { Logger } from "winston";

import logger from "./logger.ts";

export enum LogLevel {
  NOTHING = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
}

export class AppLogger {
  protected myLogger: Logger;
  protected logLevel: LogLevel;

  constructor(options?: { namespace?: string; level?: LogLevel }) {
    const { namespace, level = LogLevel.INFO } = options ?? {};
    this.logLevel = level;

    this.myLogger = logger.child({
      namespace,
      level,
    });
  }

  info(message: any, extra?: object) {
    if (this.logLevel >= LogLevel.INFO)
      this.myLogger.info({ message, ...extra });
  }

  error(message: any, extra?: object) {
    if (this.logLevel >= LogLevel.ERROR)
      this.myLogger.error({ message, ...extra });
  }

  warn(message: any, extra?: object) {
    if (this.logLevel >= LogLevel.WARN)
      this.myLogger.warn({ message, ...extra });
  }

  debug(message: any, extra?: object) {
    if (this.logLevel >= LogLevel.DEBUG)
      this.myLogger.debug({ message, ...extra });
  }

  setLogLevel(logLevel: number) {
    this.logLevel = logLevel;
  }

  namespace(namespace: string, level?: number) {
    return new AppLogger({ namespace, level: level ?? LogLevel.INFO });
  }
}

export const appLogger = new AppLogger();
