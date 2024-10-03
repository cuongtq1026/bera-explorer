import type { TokenDto } from "@database/dto.ts";
import {
  type Block,
  erc20Abi,
  getContract,
  type GetTransactionReceiptReturnType,
  type GetTransactionReturnType,
  type Hash,
} from "viem";

import logger from "../monitor/logger.ts";
import { rpcRequestCounter } from "../monitor/prometheus.ts";
import rpcRequest from "./rpc-request";
import type { TraceCallNested } from "./rpc-request/types.ts";

/**
 * Retrieves a block from the Ethereum blockchain using viem.
 * @param blockNumber The block number to retrieve. If not provided, retrieves the latest block.
 * @returns A Promise that resolves to the block data or null if the block is not found.
 */
export async function getBlock(blockNumber?: bigint): Promise<Block> {
  logger.info(`[getBlock] blockNumber: ${blockNumber}`);

  const client = await rpcRequest.getClient();
  try {
    rpcRequestCounter.inc({
      rpc: client.key,
    });

    if (blockNumber !== undefined) {
      return client.instance.getBlock({
        blockNumber: blockNumber,
        includeTransactions: false,
      });
    }

    return await client.instance.getBlock({
      blockTag: "latest",
      includeTransactions: false,
    });
  } catch (error) {
    logger.error(
      `[Block: ${blockNumber} | RpcClient: ${client.key}] Error fetching block: ${error}`,
    );

    await rpcRequest.blacklist(client);
    throw error;
  }
}

/**
 * Retrieves a transaction from the Ethereum blockchain using viem.
 * @param txHash The transaction hash to retrieve.
 * @returns A Promise that resolves to the transaction data or null if the transaction is not found.
 */
export async function getTransaction(
  txHash: Hash,
): Promise<GetTransactionReturnType> {
  logger.info(`[getTransaction] hash: ${txHash}`);

  const client = await rpcRequest.getClient();
  try {
    rpcRequestCounter.inc({
      rpc: client.key,
    });

    return await client.instance.getTransaction({
      hash: txHash,
    });
  } catch (error) {
    logger.error(
      `[TxHash: ${txHash} | RpcClient: ${client.key}] Error fetching transaction: ${error}`,
    );

    await rpcRequest.blacklist(client);
    throw error;
  }
}

/**
 * Retrieves a transaction receipt from the Ethereum blockchain using viem.
 * @param txHash The transaction hash to retrieve the receipt for.
 * @returns A Promise that resolves to the transaction receipt or null if not found.
 */
export async function getTransactionReceipt(
  txHash: Hash,
): Promise<GetTransactionReceiptReturnType> {
  logger.info(`[getTransactionReceipt] hash: ${txHash}`);

  const client = await rpcRequest.getClient();
  try {
    rpcRequestCounter.inc({
      rpc: client.key,
    });

    return await client.instance.getTransactionReceipt({
      hash: txHash,
    });
  } catch (error) {
    logger.error(
      `[TxHash: ${txHash} | RpcClient: ${client.key}] Error fetching transaction receipt: ${error}`,
    );

    await rpcRequest.blacklist(client);
    throw error;
  }
}

export async function getAllTracerCallsTransaction(
  txHash: Hash,
): Promise<TraceCallNested> {
  logger.info(`[getDebugTraceTransaction] hash: ${txHash}`);

  const debugClient = await rpcRequest.getDebugClient();
  try {
    rpcRequestCounter.inc({
      rpc: debugClient.key,
    });

    return await debugClient.instance.traceTransaction(txHash, {
      tracer: "callTracer",
    });
  } catch (error) {
    logger.error(
      `[TxHash: ${txHash} | RpcClient: ${debugClient.key}] Error fetching internal transaction: ${error}`,
    );

    await rpcRequest.blacklist(debugClient);
    throw error;
  }
}

const ERC20_FUNCTION_NAMES = ["name", "symbol", "decimals", "totalSupply"];
export async function getERC20Tokens(
  addressSet: Set<Hash>,
): Promise<TokenDto[]> {
  if (!addressSet.size) return [];

  const addresses = [...addressSet];
  logger.info(`[getERC20Tokens] addresses: ${addresses}`);

  const client = await rpcRequest.getClient();
  try {
    const contracts = addresses.map((address) => {
      const contract = getContract({
        address,
        abi: erc20Abi,
        client: client.instance,
      });
      return ERC20_FUNCTION_NAMES.map((functionName) => ({
        ...contract,
        functionName,
      }));
    });

    const results = await client.instance.multicall({
      contracts: contracts.flat(),
    });

    const tokens: TokenDto[] = [];
    for (let i = 0; i < results.length; i += 4) {
      const address = addresses[i / 4];
      const name = results[i];
      const symbol = results[1 + i];
      const decimals = results[2 + i];
      const totalSupply = results[3 + i];

      if (
        name.status === "failure" ||
        symbol.status === "failure" ||
        decimals.status === "failure" ||
        totalSupply.status === "failure"
      ) {
        continue;
      }
      tokens.push({
        address,
        name: name.result as string,
        symbol: symbol.result as string,
        decimals: decimals.result as number,
        totalSupply: totalSupply.result as bigint,
      });
    }
    return tokens;
  } catch (error) {
    logger.error(
      `[Address: ${addressSet} | RpcClient: ${client.key}] Error fetching erc20 contract data: ${error}`,
    );

    // await rpcRequest.blacklist(client);
    throw error;
  }
}
