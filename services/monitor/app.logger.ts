import type { LogEntry, Logger } from "winston";

import logger from "./logger.ts";

export enum LogLevel {
  NOTHING = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 4,
  DEBUG = 5,
}
const logLevels: { [key: string]: string } = {
  [LogLevel.NOTHING]: "nothing",
  [LogLevel.ERROR]: "error",
  [LogLevel.WARN]: "warn",
  [LogLevel.INFO]: "info",
  [LogLevel.DEBUG]: "debug",
};

export function getLevelByNumber(levelNumber: number): string {
  const levelStr = logLevels[levelNumber.toString()];
  if (!levelStr) {
    throw new Error(`Invalid log level number ${levelNumber}`);
  }

  return levelStr;
}

export class AppLogger {
  protected myLogger: Logger;
  protected logLevel: LogLevel;

  constructor(options?: {
    namespace?: string;
    level?: LogLevel;
    label?: string;
  }) {
    const { namespace, level = LogLevel.INFO, label } = options ?? {};
    this.logLevel = level;

    this.myLogger = logger.child({
      namespace,
      level,
      label,
    });
  }

  log(log: LogEntry) {
    this.myLogger.log(log);
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

  namespace(
    namespace: string,
    options?: {
      level?: number;
      label?: string;
    },
  ) {
    const { level, label } = options ?? {};
    return new AppLogger({ namespace, level: level ?? LogLevel.DEBUG, label });
  }
}

export const appLogger = new AppLogger();
