import {
  type Block,
  createPublicClient,
  type GetTransactionReceiptReturnType,
  type GetTransactionReturnType,
  type Hash,
  http,
} from "viem";
import { berachainTestnetbArtio } from "viem/chains";

import logger from "../monitor/logger.ts";

const client = createPublicClient({
  chain: berachainTestnetbArtio,
  transport: http(process.env.RPC_URL),
});

/**
 * Retrieves a block from the Ethereum blockchain using viem.
 * @param blockNumber The block number to retrieve. If not provided, retrieves the latest block.
 * @returns A Promise that resolves to the block data or null if the block is not found.
 */
export async function getBlock(blockNumber?: bigint): Promise<Block | null> {
  logger.info(`[getBlock] blockNumber: ${blockNumber}`);

  try {
    if (blockNumber !== undefined) {
      return client.getBlock({
        blockNumber: blockNumber,
        includeTransactions: true,
      });
    }

    return await client.getBlock({
      blockTag: "latest",
      includeTransactions: true,
    });
  } catch (error) {
    logger.error(`Error fetching block: ${error}`);
    return null;
  }
}

/**
 * Retrieves a transaction from the Ethereum blockchain using viem.
 * @param txHash The transaction hash to retrieve.
 * @returns A Promise that resolves to the transaction data or null if the transaction is not found.
 */
export async function getTransaction(
  txHash: Hash,
): Promise<GetTransactionReturnType | null> {
  try {
    return await client.getTransaction({
      hash: txHash,
    });
  } catch (error) {
    logger.error(`Error fetching transaction: ${error}`);
    return null;
  }
}

/**
 * Retrieves a transaction receipt from the Ethereum blockchain using viem.
 * @param txHash The transaction hash to retrieve the receipt for.
 * @returns A Promise that resolves to the transaction receipt or null if not found.
 */
export async function getTransactionReceipt(
  txHash: Hash,
): Promise<GetTransactionReceiptReturnType | null> {
  try {
    return client.getTransactionReceipt({
      hash: txHash,
    });
  } catch (error) {
    logger.error(`Error fetching transaction receipt: ${error}`);
    return null;
  }
}
