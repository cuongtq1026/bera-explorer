import { createLogger, format, transports } from "winston";

const logger = createLogger({
  level: "info",
  format: format.combine(format.timestamp(), format.json()),
  transports: [
    new transports.File({ filename: "logs/error.log", level: "error" }),
    new transports.File({ filename: "logs/info.log" }),
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
