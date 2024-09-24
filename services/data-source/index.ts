import {
  type Block,
  type GetTransactionReceiptReturnType,
  type GetTransactionReturnType,
  type Hash,
} from "viem";

import logger from "../monitor/logger.ts";
import { rpcRequestCounter } from "../monitor/prometheus.ts";
import rpcRequest from "./rpc-request.ts";

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
      url: client.url,
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
    logger.error(`Error fetching block: ${error}`);

    await rpcRequest.blacklist(client.url);
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
    return await client.instance.getTransaction({
      hash: txHash,
    });
  } catch (error) {
    logger.error(`Error fetching transaction: ${error}`);

    await rpcRequest.blacklist(client.url);
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
    return client.instance.getTransactionReceipt({
      hash: txHash,
    });
  } catch (error) {
    logger.error(`Error fetching transaction receipt: ${error}`);

    await rpcRequest.blacklist(client.url);
    throw error;
  }
}
