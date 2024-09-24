import { createClient } from "redis";

import logger from "../monitor/logger.ts";

const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

redisClient.on("error", (err) => {
  throw Error("Redis Client Error", err);
});

logger.info("⌛️ Connecting to Redis");
await redisClient.connect();
logger.info("✅  Connected to Redis");
await redisClient.set("test3", "1", {
  EX: 60,
});

export default redisClient;
