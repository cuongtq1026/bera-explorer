import { AbstractConnectable } from "@interfaces/connectable.abstract.ts";
import {
  createClient,
  createPublicClient,
  createWalletClient,
  http,
  type WalletClient,
} from "viem";
import { berachainTestnetbArtio } from "viem/chains";

import { appLogger } from "../../monitor/app.logger.ts";
import { rpcBlacklistCounter } from "../../monitor/prometheus.ts";
import { getHostFromUrl } from "../../utils.ts";
import redisConnection from "../redis-connection.ts";
import { extendDebugClient } from "./extends.ts";
import type { RpcClient, RpcDebugClient } from "./types.ts";

const serviceLogger = appLogger.namespace("RpcRequest");

const BLACKLIST_KEY = "rpc_url:blacklist";

export class RpcRequest extends AbstractConnectable {
  private publicClients: RpcClient[];
  private debugClients: RpcDebugClient[];
  private walletClient: WalletClient;
  private nextClientIndex = 0;

  constructor() {
    super({
      logger: appLogger.namespace(RpcRequest.name),
    });
  }

  async connect() {
    if (this.connected && this.publicClients) return;

    const envRpcUrls = process.env.RPC_URLS;
    if (!envRpcUrls) {
      throw new Error("No RPC URLs provided");
    }

    const rpcUrls = envRpcUrls.split(",");
    serviceLogger.info(`Number of RPC URLs provided: ${rpcUrls.length}`);

    this.publicClients = rpcUrls.map((url, index) => ({
      url,
      instance: createPublicClient({
        chain: berachainTestnetbArtio,
        transport: http(url),
      }),
      key: `${index}|${getHostFromUrl(url)}`,
    }));

    const envDebugRpcUrls = process.env.DEBUG_RPC_URLS;
    if (envDebugRpcUrls) {
      const debugRpcUrls = envDebugRpcUrls.split(",");
      serviceLogger.info(
        `Number of Debug RPC URLs provided: ${debugRpcUrls.length}`,
      );

      this.debugClients = debugRpcUrls.map((url, index) => ({
        url,
        instance: createClient({
          chain: berachainTestnetbArtio,
          transport: http(url),
        }).extend(extendDebugClient),
        key: `${index}|${getHostFromUrl(url)}`,
      }));
    }

    const walletRpcURL = process.env.WALLET_RPC_URL;
    if (!walletRpcURL) {
      throw new Error("No WALLET_RPC_URL provided");
    }
    this.walletClient = createWalletClient({
      chain: berachainTestnetbArtio,
      transport: http(walletRpcURL),
    });

    if (!envDebugRpcUrls) {
      serviceLogger.warn("No Debug RPC URLs provided");
    }

    this.connected = true;
  }

  private getBlacklistKey(url: string) {
    return BLACKLIST_KEY + ":" + url;
  }

  async blacklist(client: RpcClient | RpcDebugClient) {
    const redisClient = await redisConnection.getClient();
    await redisClient.set(this.getBlacklistKey(client.key), "1", {
      EX: 60,
    });

    rpcBlacklistCounter.inc({
      rpc: client.key,
    });

    serviceLogger.info("RPC URL blacklisted: " + client.key);
  }

  async isBlacklisted(key: string) {
    const redisClient = await redisConnection.getClient();

    const result = await redisClient.get(this.getBlacklistKey(key));
    return result === "1";
  }

  async getDebugClient(): Promise<RpcDebugClient> {
    await this.checkConnection();

    return this.debugClients[0];
  }

  async getWalletClient() {
    await this.checkConnection();

    return this.walletClient;
  }

  async getPublicClient(): Promise<RpcClient> {
    await this.checkConnection();

    const nextClient = this.publicClients[this.nextClientIndex];
    this.nextClientIndex =
      (this.nextClientIndex + 1) % this.publicClients.length;

    // if the next client isn't blacklisted, return it
    const isNextClientBlacklisted = await this.isBlacklisted(nextClient.key);
    if (!isNextClientBlacklisted) {
      return nextClient;
    }

    for (const client of this.publicClients) {
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

    serviceLogger.warn(
      `All RPC URLs are blacklisted. Wait and retry in 1 second.`,
    );
    await new Promise((resolve) =>
      setTimeout(() => {
        resolve(0);
      }, 1000),
    );

    return this.getPublicClient();
  }
}

const rpcRequest = new RpcRequest();

export default rpcRequest;
