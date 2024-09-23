import { createLogger, format, transports } from "winston";
import DailyRotateFile from "winston-daily-rotate-file";

const logger = createLogger({
  level: "info",
  format: format.combine(format.timestamp(), format.json()),
  transports: [
    new DailyRotateFile({
      filename: "logs/error-%DATE%.log",
      level: "error",
      datePattern: "YYYY-MM-DD",
    }),
    new DailyRotateFile({
      filename: "logs/info-%DATE%.log",
      datePattern: "YYYY-MM-DD",
    }),
  ],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(
    new transports.Console({
      format: format.combine(
        format.colorize({ all: true }),
        format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        format.printf(({ level, message, timestamp, ...metadata }) => {
          let msg = `${timestamp} ${level} ${message}`;
          if (metadata.file) {
            msg += ` [${metadata.file}:${metadata.line}]`;
          }
          return msg;
        }),
      ),
    }),
  );
}

export default logger;
