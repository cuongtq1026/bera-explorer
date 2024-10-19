import { createClient } from "redis";

import { appLogger } from "../monitor/app.logger.ts";

const serviceLogger = appLogger.namespace("Redis");

const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

redisClient.on("error", (err) => {
  throw Error("Redis Client Error", err);
});

serviceLogger.info("⌛️ Connecting to Redis");
await redisClient.connect();
serviceLogger.info("✅  Connected to Redis");

export default redisClient;
