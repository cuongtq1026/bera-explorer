import { createPublicClient, http, type PublicClient } from "viem";
import { berachainTestnetbArtio } from "viem/chains";

import logger from "../monitor/logger.ts";
import { rpcBlacklistCounter } from "../monitor/prometheus.ts";
import { getHostFromUrl } from "../utils.ts";
import redisClient from "./redis-client.ts";

type Client = {
  instance: PublicClient;
  url: string;
  key: string;
};

const BLACKLIST_KEY = "rpc_url:blacklist";

export class RpcRequest {
  private readonly clients: Client[];
  private nextClientIndex = 0;

  constructor() {
    const envRpcUrls = process.env.RPC_URLS;
    if (!envRpcUrls) {
      throw new Error("No RPC URLs provided");
    }

    const rpcUrls = envRpcUrls.split(",");
    logger.info(`Number of RPC URLs provided: ${rpcUrls.length}`);

    this.clients = rpcUrls.map((url, index) => ({
      url,
      instance: createPublicClient({
        chain: berachainTestnetbArtio,
        transport: http(url),
      }),
      key: `${index}|${getHostFromUrl(url)}`,
    }));
  }

  private getBlacklistKey(url: string) {
    return BLACKLIST_KEY + ":" + url;
  }

  async blacklist(client: Client) {
    await redisClient.set(this.getBlacklistKey(client.key), "1", {
      EX: 60,
    });

    rpcBlacklistCounter.inc({
      rpc: client.key,
    });

    logger.info("RPC URL blacklisted: " + client.key);
  }

  async isBlacklisted(key: string) {
    const result = await redisClient.get(this.getBlacklistKey(key));
    return result === "1";
  }

  async getClient(): Promise<Client> {
    const nextClient = this.clients[this.nextClientIndex];
    this.nextClientIndex = (this.nextClientIndex + 1) % this.clients.length;

    // if the next client isn't blacklisted, return it
    const isNextClientBlacklisted = await this.isBlacklisted(nextClient.key);
    if (!isNextClientBlacklisted) {
      return nextClient;
    }

    for (const client of this.clients) {
      if (client.url === nextClient.url) {
        // no need to check blacklisted since we already did
        continue;
      }

      const { key } = client;
      const isBlacklisted = await this.isBlacklisted(key);

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
