import {
  decodeTransferLog,
  type SwapDto,
  type TransactionDto,
} from "@database/dto.ts";
import { decodeFunctionData, type Hash } from "viem";

import CrocMultiSwapABI from "../config/abis/CrocMultiSwap.abi.json";
import { ERC20_TRANSFER_SIGNATURE } from "../config/constants.ts";
import type { SwapDecoder } from "./interface.decoder.ts";

type Step = {
  poolIdx: bigint;
  base: Hash;
  quote: Hash;
  isBuy: boolean;
};
type DecodedInputType = {
  steps: Step[];
  amount: bigint;
  minOut: bigint;
};

export class CrocSwapDexDecoder implements SwapDecoder<DecodedInputType> {
  decodeTx(transaction: TransactionDto): {
    functionName: string;
    decoded: DecodedInputType;
  } {
    const { functionName, args } = decodeFunctionData({
      abi: CrocMultiSwapABI,
      data: transaction.input as Hash,
    });

    const [steps, amount, minOut] = args as [Step[], bigint, bigint];
    return {
      functionName,
      decoded: {
        steps: steps.map((step) => ({
          poolIdx: step.poolIdx,
          base: step.base.toLowerCase() as Hash,
          quote: step.quote.toLowerCase() as Hash,
          isBuy: step.isBuy,
        })),
        amount,
        minOut,
      },
    };
  }

  decodeSwaps(transaction: TransactionDto): SwapDto[] {
    /*
                functionName multiSwap
                args [
                  [
                    {
                      poolIdx: 36000n,
                      base: "0x0E4aaF1351de4c0264C5c7056Ef3777b41BD8e03",
                      quote: "0x7507c1dc16935B82698e4C63f2746A2fCf994dF8",
                      isBuy: false,
                    }
                  ], 1000000000000000000n, 98628165777559566590n
                ]
               */

    /*
          find routes
        */
    const { decoded } = this.decodeTx(transaction);
    const { steps, amount, minOut } = decoded;
    const expectedRouteSet = steps
      // take out "base" and "quote"
      .map((step) =>
        step.isBuy ? [step.base, step.quote] : [step.quote, step.base],
      )
      .flat()
      // remove duplicated address
      .reduce((routeSet, route) => {
        routeSet.add(route);

        return routeSet;
      }, new Set<Hash>());
    const expectedRoutes = [...expectedRouteSet];

    // expectedRoutes [ "0x7507c1dc16935B82698e4C63f2746A2fCf994dF8", "0x0E4aaF1351de4c0264C5c7056Ef3777b41BD8e03" ]
    /*
        validate routes by transfers
        need to check "tokenAddress", "from", "to", "amount", "minOut"
        */

    // undefined check
    if (!transaction.to) {
      throw Error(`[${transaction.hash}] No transaction.to found.`);
    }
    const receipt = transaction.receipt;
    if (!receipt) {
      throw Error(`[${transaction.hash}] No receipt found.`);
    }
    const logs = transaction.receipt?.logs;
    if (!logs) {
      throw Error(`[${transaction.hash}] No logs found.`);
    }
    logs.forEach((log) => {
      if (!log.topics) {
        throw Error(`[${log.logHash}] No log topics found.`);
      }
    });

    /*
        start validating swap transaction
        */
    const fromToken = expectedRoutes[0];
    const toToken = expectedRoutes[expectedRoutes.length - 1];
    // first route, check correct amount in
    const fromTransferLog = logs.find((log) => {
      const topics = log.topics!;
      const signature = topics[0]?.topic;
      const isErc20TransferLog = signature === ERC20_TRANSFER_SIGNATURE;
      if (!isErc20TransferLog) return false;

      // decode log
      const decodedTransfer = decodeTransferLog(log, topics!);
      if (decodedTransfer == null) {
        return false;
      }

      return (
        decodedTransfer.value === amount &&
        decodedTransfer.from === transaction.from &&
        decodedTransfer.tokenAddress === fromToken
      );
    });
    const isFromValid = fromTransferLog != null;

    // check if there are enough routes' swaps (3 routes = 3 swaps = 6 transfers)
    const isRouteSwapValid = expectedRoutes.every((route, index) => {
      // check "index" and "index + 1" so we will skip the last element which is "index + 1"
      if (index === expectedRoutes.length - 1) {
        return true;
      }
      const fromToken = route;
      const toToken = expectedRoutes[index + 1];

      // find from transfer
      const hasFromTransfer = logs.some((log) => {
        const topics = log.topics!;
        const signature = topics[0]?.topic;
        const isErc20TransferLog = signature === ERC20_TRANSFER_SIGNATURE;
        if (!isErc20TransferLog) return false;

        return log.address === fromToken;
      });
      const hasToTransfer = logs.some((log) => {
        const topics = log.topics!;
        const signature = topics[0]?.topic;
        const isErc20TransferLog = signature === ERC20_TRANSFER_SIGNATURE;
        if (!isErc20TransferLog) return false;

        return log.address === toToken;
      });

      return hasFromTransfer && hasToTransfer;
    });

    // last route, check correct amount out
    const toTransferLog = logs.find((log) => {
      const topics = log.topics!;
      const signature = topics[0]?.topic;
      const isErc20TransferLog = signature === ERC20_TRANSFER_SIGNATURE;
      if (!isErc20TransferLog) return false;

      // decode log
      const decodedTransfer = decodeTransferLog(log, topics);
      if (decodedTransfer == null) {
        return false;
      }

      return (
        decodedTransfer.value >= minOut &&
        decodedTransfer.to === transaction.to &&
        decodedTransfer.tokenAddress === toToken
      );
    });
    const isToValid = toTransferLog != null;

    const isEverythingValid = isFromValid && isRouteSwapValid && isToValid;
    if (!isEverythingValid) {
      throw Error(
        `[${transaction.hash}] Invalid swap transaction. ${isFromValid ? 1 : 0}|${isRouteSwapValid ? 1 : 0}|${isToValid ? 1 : 0}`,
      );
    }

    // TODO: Work with multiple swaps, we only return 1 swap for now
    const decodedFromTransfer = decodeTransferLog(
      fromTransferLog,
      fromTransferLog.topics!,
    );
    const decodedToTransfer = decodeTransferLog(
      toTransferLog,
      toTransferLog.topics!,
    );
    if (decodedFromTransfer == null) {
      throw Error("decodedFromTransfer is null");
    }
    if (decodedToTransfer == null) {
      throw Error("decodedToTransfer is null");
    }

    return [
      {
        blockNumber: transaction.blockNumber,
        transactionHash: transaction.hash,
        dex: transaction.to,
        from: decodedFromTransfer.tokenAddress,
        to: decodedToTransfer.tokenAddress,
        fromAmount: decodedFromTransfer.value,
        toAmount: decodedToTransfer.value,
        createdAt: receipt.createdAt,
      },
    ];
  }
}
