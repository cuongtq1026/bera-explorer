import { createPublicClient, http, type PublicClient } from "viem";
import { berachainTestnetbArtio } from "viem/chains";

import logger from "../monitor/logger.ts";
import { rpcBlacklistCounter } from "../monitor/prometheus.ts";
import redisClient from "./redis-client.ts";

type Client = {
  instance: PublicClient;
  url: string;
};

const BLACKLIST_KEY = "rpc_url:blacklist";

export class RpcRequest {
  private readonly clients: Client[];

  constructor() {
    const envRpcUrls = process.env.RPC_URLS;
    if (!envRpcUrls) {
      throw new Error("No RPC URLs provided");
    }

    this.clients = envRpcUrls.split(",").map((url) => ({
      url,
      instance: createPublicClient({
        chain: berachainTestnetbArtio,
        transport: http(url),
      }),
    }));
  }

  private getBlacklistKey(url: string) {
    return BLACKLIST_KEY + ":" + url;
  }

  async blacklist(url: string) {
    await redisClient.set(this.getBlacklistKey(url), "1", {
      EX: 60,
    });

    rpcBlacklistCounter.inc({
      url,
    });

    logger.info("RPC URL blacklisted: " + url);
  }

  async isBlacklisted(url: string) {
    const result = await redisClient.get(this.getBlacklistKey(url));
    return result === "1";
  }

  async getClient(): Promise<Client> {
    for (const client of this.clients) {
      const { url } = client;
      const isBlacklisted = await this.isBlacklisted(url);

      if (isBlacklisted) {
        continue;
      }

      return client;
    }

    logger.warn(`All RPC URLs are blacklisted. Wait and retry in 1 second.`);
    await new Promise((resolve) =>
      setTimeout(() => {
        resolve(0);
      }, 1000),
    );

    return this.getClient();
  }
}

const rpcRequest = new RpcRequest();

export default rpcRequest;
