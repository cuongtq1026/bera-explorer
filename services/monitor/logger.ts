import chalk from "chalk";
import { createLogger, format, transports } from "winston";
import DailyRotateFile from "winston-daily-rotate-file";

const logger = createLogger({
  level: "info",
  defaultMeta: {
    environment: process.env.NODE_ENV || "development",
  },
  format: format.combine(format.timestamp(), format.json()),
  transports: [
    new DailyRotateFile({
      filename: "logs/error-%DATE%.log",
      level: "error",
      datePattern: "YYYY-MM-DD",
      maxSize: "100m",
    }),
    new DailyRotateFile({
      filename: "logs/warn-%DATE%.log",
      level: "warn",
      datePattern: "YYYY-MM-DD",
      maxSize: "100m",
      format: format.combine(
        format((info) => {
          if (info.level === "warn") return info;
          return false;
        })(),
      ),
    }),
    new DailyRotateFile({
      filename: "logs/info-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxSize: "100m",
      format: format.combine(
        format((info) => {
          if (info.level !== "warn" && info.level !== "error") return info;
          return false;
        })(),
      ),
    }),
  ],
});

if (process.env.NODE_ENV !== "production") {
  const levelColors = {
    info: chalk.cyan,
    warn: chalk.yellow,
    error: chalk.red.bold,
    debug: chalk.magenta,
  };

  logger.add(
    new transports.Console({
      level: "debug",
      format: format.combine(
        format.timestamp({ format: "YYYY-MM-DD, HH:mm:ss.SSS" }),
        format.printf(
          ({
            environment: _environment,
            level,
            message,
            label,
            namespace,
            timestamp,
            file,
            ...metadata
          }) => {
            const colorize =
              levelColors[level as keyof typeof levelColors] || chalk.white;

            const messages = [
              chalk.blue("PID:"),
              chalk.green(process.pid),
              "-",
              chalk.gray(timestamp),
            ];
            if (label) {
              messages.push(chalk.bold(label));
            }
            messages.push(colorize(level));
            if (namespace) {
              messages.push(chalk.blue(`${namespace}:`));
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
        format.errors({ stack: true }),
      ),
    }),
  );
}

export default logger;
