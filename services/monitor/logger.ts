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
      maxSize: "100m",
    }),
    new DailyRotateFile({
      filename: "logs/info-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxSize: "100m",
    }),
  ],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(
    new transports.Console({
      level: "debug",
      format: format.combine(
        format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        format.printf(
          ({
            level,
            message,
            label,
            namespace,
            timestamp,
            file,
            ...metadata
          }) => {
            const messages = [];
            messages.push(timestamp);
            if (label) {
              messages.push(`[${label}]`);
            }
            messages.push(level.toUpperCase());
            if (namespace) {
              messages.push(namespace);
            }
            messages.push(message);
            if (file) {
              messages.push(`[${metadata.file}:${metadata.line}]`);
            }
            const otherMessage = JSON.stringify(metadata);
            if (otherMessage && otherMessage !== "{}") {
              messages.push(otherMessage);
            }
            return messages.join(" ");
          },
        ),
        format.colorize({ all: true }),
      ),
    }),
  );
}

export default logger;
