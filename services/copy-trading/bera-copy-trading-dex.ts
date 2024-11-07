import { getContract } from "viem";

import { BeraCopyAbi } from "../config/abis";
import { ETH_ADDRESS } from "../config/constants.ts";
import rpcRequest from "../data-source/rpc-request";
import { getDecoder } from "../decoder";
import { CrocSwapDexDecoder } from "../decoder/croc-swap-dex.decoder.ts";
import { CopyTradeMessagePayload } from "../queues/kafka/producers";
import { getSignature } from "../utils.ts";
import {
  CopyTradingDEX,
  type CopyTradingExecuteParams,
} from "./copy-trading-dex.abstract.ts";

// TODO: Fix this, not finished yet
export class BeraCopyTradingDex extends CopyTradingDEX {
  async execute(
    params: CopyTradingExecuteParams,
  ): Promise<CopyTradeMessagePayload> {
    const { account, copyContractAddress, swap, transaction } = params;
    try {
      const client = await rpcRequest.getWalletClient();

      const signature = getSignature(transaction.input);
      const decoder = getDecoder(signature);
      if (decoder == null) {
        throw new Error("Invalid signature");
      }
      const isCrocSwapDex = decoder instanceof CrocSwapDexDecoder;
      if (!isCrocSwapDex) {
        throw new Error("Invalid dex");
      }

      const transactionInputArgs = decoder.decodeTx(transaction);

      const contract = getContract({
        address: copyContractAddress,
        abi: BeraCopyAbi,
        client,
      });

      const txHash = await contract.write.multiSwap(
        [
          this.dexAddress,
          transactionInputArgs.decoded.steps,
          swap.fromAmount, // Exact copy for now
          0n, // 0 for now, will be added to the contract slippage
        ],
        {
          chain: client.chain,
          account,
          value: swap.from === ETH_ADDRESS ? swap.fromAmount : 0n,
        },
      );
      this.serviceLogger.info(
        `Copy trade sent. SwapHash: ${swap.hash} | TxHash: ${txHash}`,
      );
      return {
        swapHash: swap.hash,
        isSuccess: true,
        transactionHash: txHash,
        error: null,
      } as CopyTradeMessagePayload<true>;
    } catch (e: unknown) {
      this.serviceLogger.error(
        `Error on processing copy trading on SwapHash: ${swap.hash}`,
      );

      if (e instanceof Error && e.stack) {
        return {
          swapHash: swap.hash,
          isSuccess: false,
          transactionHash: null,
          error: e.stack,
        } as CopyTradeMessagePayload<false>;
      }
      throw e;
    }
  }
}
