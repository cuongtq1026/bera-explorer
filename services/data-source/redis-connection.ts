import { AbstractConnectable } from "@interfaces/connectable.abstract.ts";
import { createClient, type RedisClientType } from "redis";

import { appLogger } from "../monitor/app.logger.ts";

const serviceLogger = appLogger.namespace("Redis");

export class RedisConnection extends AbstractConnectable {
  private client: RedisClientType;

  async connect() {
    if (this.connected && this.client) return;

    this.client = createClient({
      url: process.env.REDIS_URL || "redis://localhost:6379",
    });

    serviceLogger.info("⌛️ Connecting to Redis");
    await this.client.connect();
    serviceLogger.info("✅  Connected to Redis");

    this.client.on("error", (err) => {
      throw Error("Redis Client Error", err);
    });

    this.connected = true;
  }

  async getClient() {
    await this.checkConnection();

    return this.client;
  }
}

const redisConnection = new RedisConnection();

export default redisConnection;
