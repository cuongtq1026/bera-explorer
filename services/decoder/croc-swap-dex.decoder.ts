import {
  decodeTransferLog,
  decodeWithdrawalLog,
  type LogDto,
  type LogTopicDto,
  type SwapDto,
  type TransactionDto,
} from "@database/dto.ts";
import { decodeFunctionData, type Hash } from "viem";

import CrocMultiSwapABI from "../config/abis/CrocMultiSwap.abi.json";
import {
  ERC20_TRANSFER_SIGNATURE,
  ETH_ADDRESS,
  WRAPPED_ETH_ADDRESS,
} from "../config/constants.ts";
import { InvalidSwapException } from "../exceptions/decoder.exception.ts";
import type { DecodeArg, ISwapDecoder } from "./swap.interface.decoder.ts";

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

function getFromTransferLog({
  logs,
  transaction,
  amount,
  fromToken,
}: {
  logs: (LogDto & {
    topics: LogTopicDto[];
  })[];
  transaction: TransactionDto;
  amount: bigint;
  fromToken: string;
}):
  | (LogDto & {
      topics: LogTopicDto[];
    })
  | undefined {
  return logs.find((log) => {
    const topics = log.topics;
    const signature = topics[0]?.topic;
    const isErc20TransferLog = signature === ERC20_TRANSFER_SIGNATURE;
    if (!isErc20TransferLog) return false;

    // decode log
    const decodedTransfer = decodeTransferLog(log, topics);
    if (decodedTransfer == null) {
      return false;
    }

    return (
      decodedTransfer.value === amount &&
      decodedTransfer.from === transaction.from &&
      decodedTransfer.tokenAddress === fromToken
    );
  });
}

function getETHTransferToLog(
  transaction: TransactionDto,
  logs: (LogDto & {
    topics: LogTopicDto[];
  })[],
  minOut: bigint,
):
  | (LogDto & {
      topics: LogTopicDto[];
    })
  | undefined {
  const withdrawalLog = logs.find((log) => {
    return decodeWithdrawalLog(log, log.topics) != null;
  });
  if (withdrawalLog == null) {
    throw new InvalidSwapException(
      CrocSwapDexDecoder.name,
      `[${transaction.hash}] No withdrawal log found`,
    );
  }

  const decodedWithdrawalLog = decodeWithdrawalLog(
    withdrawalLog,
    withdrawalLog.topics,
  );
  if (decodedWithdrawalLog == null) {
    throw new InvalidSwapException(
      CrocSwapDexDecoder.name,
      `[${withdrawalLog.logHash}] decodedWithdrawalLog failed`,
    );
  }
  return logs.find((log) => {
    // decode log
    const decodedTransfer = decodeTransferLog(log, log.topics);
    if (decodedTransfer == null) {
      return false;
    }

    return (
      decodedTransfer.value === decodedWithdrawalLog.amount &&
      decodedTransfer.from === decodedWithdrawalLog.to &&
      decodedTransfer.to === ETH_ADDRESS &&
      log.address === WRAPPED_ETH_ADDRESS &&
      decodedTransfer.value >= minOut
    );
  });
}

export class CrocSwapDexDecoder implements ISwapDecoder<DecodedInputType> {
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
    const { steps } = decoded;
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

    const validLogs = logs.filter(
      (
        log,
      ): log is LogDto & {
        topics: LogTopicDto[];
      } => {
        if (!log) {
          throw Error(`[${transaction.hash}] No log found.`);
        }
        if (!log.topics) {
          throw Error(`[${log.logHash}] No log topic found.`);
        }

        return true;
      },
    );
    const fromToken = expectedRoutes[0];
    const toToken = expectedRoutes[expectedRoutes.length - 1];

    if (fromToken === ETH_ADDRESS) {
      return this.decodeETHToToken({
        transaction,
        logs: validLogs,
        receipt,
        decoded,
        expectedRoutes,
        dex: transaction.to,
      });
    }
    if (toToken === ETH_ADDRESS) {
      return this.decodeTokenToETH({
        transaction,
        logs: validLogs,
        receipt,
        decoded,
        expectedRoutes,
        dex: transaction.to,
      });
    }
    return this.decodeTokenToToken({
      transaction,
      logs: validLogs,
      receipt,
      decoded,
      expectedRoutes,
      dex: transaction.to,
    });
  }

  // 0xbe6c65cf89e2c42171467fd69c3c8214d7618bf36aeb00743fded75415892420
  decodeETHToToken(args: DecodeArg<DecodedInputType>): SwapDto[] {
    const { transaction, logs, receipt, decoded, expectedRoutes, dex } = args;
    const { amount, minOut } = decoded;
    const fromToken = expectedRoutes[0];
    const toToken = expectedRoutes[expectedRoutes.length - 1];

    // first route, check correct amount in
    const isFromValid = transaction.value === amount;

    // check if there are enough routes' swaps (3 routes = 3 swaps = 6 transfers)
    const isRouteSwapValid = expectedRoutes.every((route, index) => {
      // check "index" and "index + 1" so we will skip the last element which is "index + 1"
      if (index === expectedRoutes.length - 1) {
        return true;
      }

      // because it's ETH to Token so we will manually check the first transfer
      if (index === 0) {
        // checked by isFromValid transaction.value
        // now we will check wrapped eth erc20 transfer
        const hasFromTransfer = logs.some((log) => {
          const topics = log.topics;
          const signature = topics[0]?.topic;
          const isErc20TransferLog = signature === ERC20_TRANSFER_SIGNATURE;
          if (!isErc20TransferLog) return false;

          const decodedTransfer = decodeTransferLog(log, topics);
          if (decodedTransfer == null) {
            return false;
          }

          return (
            decodedTransfer.from === ETH_ADDRESS &&
            decodedTransfer.value === amount &&
            log.address === WRAPPED_ETH_ADDRESS
          );
        });
        const hasToTransfer = logs.some((log) => {
          const topics = log.topics;
          const signature = topics[0]?.topic;
          const isErc20TransferLog = signature === ERC20_TRANSFER_SIGNATURE;
          if (!isErc20TransferLog) return false;

          return log.address === toToken;
        });

        return hasFromTransfer && hasToTransfer;
      }
      const currentFromToken = route;
      const toNextToken = expectedRoutes[index + 1];

      // find from transfer
      const hasFromTransfer = logs.some((log) => {
        const topics = log.topics;
        const signature = topics[0]?.topic;
        const isErc20TransferLog = signature === ERC20_TRANSFER_SIGNATURE;
        if (!isErc20TransferLog) return false;

        return log.address === currentFromToken;
      });
      const hasToTransfer = logs.some((log) => {
        const topics = log.topics;
        const signature = topics[0]?.topic;
        const isErc20TransferLog = signature === ERC20_TRANSFER_SIGNATURE;
        if (!isErc20TransferLog) return false;

        return log.address === toNextToken;
      });

      return hasFromTransfer && hasToTransfer;
    });

    // last route, check correct amount out
    const toTransferLog = logs.find((log) => {
      const topics = log.topics;
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
      throw new InvalidSwapException(
        CrocSwapDexDecoder.name,
        `[${transaction.hash}] Invalid swap transaction. ${isFromValid ? 1 : 0}|${isRouteSwapValid ? 1 : 0}|${isToValid ? 1 : 0}`,
      );
    }

    const decodedToTransfer = decodeTransferLog(
      toTransferLog,
      toTransferLog.topics,
    );
    if (decodedToTransfer == null) {
      throw new InvalidSwapException(
        CrocSwapDexDecoder.name,
        "[${transaction.hash}] decodedToTransfer is null",
      );
    }

    return [
      {
        blockNumber: transaction.blockNumber,
        transactionHash: transaction.hash,
        dex,
        from: fromToken,
        to: toToken,
        fromAmount: amount,
        toAmount: decodedToTransfer.value,
        createdAt: receipt.createdAt,
      },
    ];
  }

  // 0x60eb24bfb70978656e780988324d6082db6b28b0757671d7a09ada462545fb3b
  decodeTokenToETH(args: DecodeArg<DecodedInputType>): SwapDto[] {
    const { transaction, logs, receipt, decoded, expectedRoutes, dex } = args;
    const { amount, minOut } = decoded;
    const fromToken = expectedRoutes[0];
    const toToken = expectedRoutes[expectedRoutes.length - 1];

    const fromTransferLog = getFromTransferLog({
      logs,
      amount,
      transaction,
      fromToken,
    });
    const isFromValid = fromTransferLog != null;
    // check if there are enough routes' swaps (3 routes = 3 swaps = 6 transfers)
    const isRouteSwapValid = expectedRoutes.every((route, index) => {
      if (index === expectedRoutes.length - 2) {
        // already checked by toTransferLog
        return true;
      }
      // check "index" and "index + 1" so we will skip the last element which is "index + 1"
      if (index === expectedRoutes.length - 1) {
        return true;
      }
      const fromToken = route;
      const toToken = expectedRoutes[index + 1];

      // find from transfer
      const hasFromTransfer = logs.some((log) => {
        const topics = log.topics;
        const signature = topics[0]?.topic;
        const isErc20TransferLog = signature === ERC20_TRANSFER_SIGNATURE;
        if (!isErc20TransferLog) return false;

        return log.address === fromToken;
      });
      const hasToTransfer = logs.some((log) => {
        const topics = log.topics;
        const signature = topics[0]?.topic;
        const isErc20TransferLog = signature === ERC20_TRANSFER_SIGNATURE;
        if (!isErc20TransferLog) return false;

        return log.address === toToken;
      });

      return hasFromTransfer && hasToTransfer;
    });

    const toTransferLog = getETHTransferToLog(transaction, logs, minOut);
    const isToValid = toTransferLog != null;

    const isEverythingValid = isFromValid && isRouteSwapValid && isToValid;
    if (!isEverythingValid) {
      throw new InvalidSwapException(
        CrocSwapDexDecoder.name,
        `[${transaction.hash}] Invalid swap transaction. ${isFromValid ? 1 : 0}|${isRouteSwapValid ? 1 : 0}|${isToValid ? 1 : 0}`,
      );
    }

    const decodedFromTransfer = decodeTransferLog(
      fromTransferLog,
      fromTransferLog.topics,
    );
    const decodedToTransfer = decodeTransferLog(
      toTransferLog,
      toTransferLog.topics,
    );
    if (decodedFromTransfer == null) {
      throw new InvalidSwapException(
        CrocSwapDexDecoder.name,
        `[${transaction.hash}] decodedFromTransfer is null`,
      );
    }
    if (decodedToTransfer == null) {
      throw new InvalidSwapException(
        CrocSwapDexDecoder.name,
        "[${transaction.hash}] decodedToTransfer is null",
      );
    }

    return [
      {
        blockNumber: transaction.blockNumber,
        transactionHash: transaction.hash,
        dex,
        from: fromToken,
        to: toToken,
        fromAmount: decodedFromTransfer.value,
        toAmount: decodedToTransfer.value,
        createdAt: receipt.createdAt,
      },
    ];
  }

  // 0xc3dbae551ebcf7bf3d54817e228b451a585e583262a263e1e1cc4c81b5d4fd1d
  // TODO: 0x19005e828eac316b76ba9e6f1c0749ddec8e0a91850b6d14cd28462d143419b3
  decodeTokenToToken(args: DecodeArg<DecodedInputType>): SwapDto[] {
    const { transaction, logs, receipt, decoded, expectedRoutes, dex } = args;
    const { amount, minOut } = decoded;
    const fromToken = expectedRoutes[0];
    const toToken = expectedRoutes[expectedRoutes.length - 1];

    // first route, check correct amount in
    const fromTransferLog = getFromTransferLog({
      logs,
      amount,
      transaction,
      fromToken,
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
        const topics = log.topics;
        const signature = topics[0]?.topic;
        const isErc20TransferLog = signature === ERC20_TRANSFER_SIGNATURE;
        if (!isErc20TransferLog) return false;

        return log.address === fromToken;
      });
      const hasToTransfer = logs.some((log) => {
        const topics = log.topics;
        const signature = topics[0]?.topic;
        const isErc20TransferLog = signature === ERC20_TRANSFER_SIGNATURE;
        if (!isErc20TransferLog) return false;

        return log.address === toToken;
      });

      return hasFromTransfer && hasToTransfer;
    });

    // last route, check correct amount out
    const toTransferLog = logs.find((log) => {
      const topics = log.topics;
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
      throw new InvalidSwapException(
        CrocSwapDexDecoder.name,
        `[${transaction.hash}] Invalid swap transaction. ${isFromValid ? 1 : 0}|${isRouteSwapValid ? 1 : 0}|${isToValid ? 1 : 0}`,
      );
    }

    // TODO: Work with multiple swaps, we only return 1 swap for now
    const decodedFromTransfer = decodeTransferLog(
      fromTransferLog,
      fromTransferLog.topics,
    );
    const decodedToTransfer = decodeTransferLog(
      toTransferLog,
      toTransferLog.topics,
    );
    if (decodedFromTransfer == null) {
      throw new InvalidSwapException(
        CrocSwapDexDecoder.name,
        `[${transaction.hash}] decodedFromTransfer is null`,
      );
    }
    if (decodedToTransfer == null) {
      throw new InvalidSwapException(
        CrocSwapDexDecoder.name,
        "[${transaction.hash}] decodedToTransfer is null",
      );
    }

    return [
      {
        blockNumber: transaction.blockNumber,
        transactionHash: transaction.hash,
        dex,
        from: decodedFromTransfer.tokenAddress,
        to: decodedToTransfer.tokenAddress,
        fromAmount: decodedFromTransfer.value,
        toAmount: decodedToTransfer.value,
        createdAt: receipt.createdAt,
      },
    ];
  }
}
