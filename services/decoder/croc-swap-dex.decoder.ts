import {
  decodeTransferLog,
  decodeWithdrawalLog,
  type LogDto,
  type LogTopicDto,
  type SwapDtoNoId,
  type TransactionDto,
  type TransactionReceiptDto,
} from "@database/dto.ts";
import { decodeFunctionData, type Hash } from "viem";

import { CrocMultiSwapAbi } from "../config/abis";
import {
  ERC20_TRANSFER_SIGNATURE,
  ETH_ADDRESS,
  WRAPPED_ETH_ADDRESS,
} from "../config/constants.ts";
import {
  InvalidStepSwapException,
  InvalidSwapException,
} from "../exceptions/decoder.exception.ts";
import { type AppLogger, appLogger } from "../monitor/app.logger.ts";
import { AbstractInjectLogger } from "../queues/kafka/inject-logger.abstract.ts";
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
  amount,
  fromToken,
  from,
}: {
  logs: (LogDto & {
    topics: LogTopicDto[];
  })[];
  amount: bigint;
  fromToken: string;
  from: string;
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
      decodedTransfer.from === from &&
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

function decodeMultiStepSwaps(args: {
  serviceLogger: AppLogger;
  expectedRoutes: Hash[];
  logs: (LogDto & {
    topics: LogTopicDto[];
  })[];
  transaction: TransactionDto;
  receipt: TransactionReceiptDto;
  dex: string;
  fromAndToIndex: [number, number];
}): SwapDtoNoId[] {
  const {
    serviceLogger,
    expectedRoutes,
    logs,
    transaction,
    receipt,
    dex,
    fromAndToIndex,
  } = args;
  const [f, t] = fromAndToIndex;
  return expectedRoutes
    .slice(f, t)
    .map<SwapDtoNoId | null>((_route, index) => {
      const routeFromToken = expectedRoutes[index + f];
      const routeToToken = expectedRoutes[index + f + 1];

      const fromTransfer = logs.find((log) => {
        const topics = log.topics;
        const signature = topics[0]?.topic;
        const isErc20TransferLog = signature === ERC20_TRANSFER_SIGNATURE;
        if (!isErc20TransferLog) return false;

        return log.address === routeFromToken;
      });
      const toTransfer = logs.find((log) => {
        const topics = log.topics;
        const signature = topics[0]?.topic;
        const isErc20TransferLog = signature === ERC20_TRANSFER_SIGNATURE;
        if (!isErc20TransferLog) return false;

        return log.address === routeToToken;
      });

      if (fromTransfer == null || toTransfer == null) {
        serviceLogger.warn(
          `[${transaction.hash}] No step swap transaction found. Index: ${index} | routeFromToken: ${routeFromToken} | routeToToken: ${routeToToken}.`,
        );
        return null;
      }

      const decodedFromTransfer = decodeTransferLog(
        fromTransfer,
        fromTransfer.topics,
      );
      const decodedToTransfer = decodeTransferLog(
        toTransfer,
        toTransfer.topics,
      );
      if (decodedFromTransfer == null || decodedToTransfer == null) {
        throw new InvalidStepSwapException(
          CrocSwapDexDecoder.name,
          `[${transaction.hash}] Decode step swap transaction failed. Index: ${index} | routeFromToken: ${decodedFromTransfer} | routeToToken: ${decodedToTransfer}.`,
        );
      }

      return {
        blockNumber: transaction.blockNumber,
        transactionHash: transaction.hash,
        transactionIndex: receipt.transactionIndex,
        dex,
        from: decodedFromTransfer.tokenAddress,
        to: decodedToTransfer.tokenAddress,
        fromAmount: decodedFromTransfer.value,
        toAmount: decodedToTransfer.value,
        createdAt: receipt.createdAt,
      };
    })
    .filter((swapDto): swapDto is SwapDtoNoId => swapDto != null);
}

export class CrocSwapDexDecoder
  extends AbstractInjectLogger
  implements ISwapDecoder<DecodedInputType>
{
  constructor() {
    super({
      logger: appLogger.namespace(CrocSwapDexDecoder.name),
    });
  }

  decodeTx(transaction: TransactionDto): {
    functionName: string;
    decoded: DecodedInputType;
  } {
    try {
      const { functionName, args } = decodeFunctionData({
        abi: CrocMultiSwapAbi,
        data: transaction.input as Hash,
      });

      if (functionName !== "multiSwap") {
        throw Error(
          `Not a swap transaction: ${transaction.hash}. Function name is ${functionName}.`,
        );
      }

      const [steps, amount, minOut] = args;
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
    } catch (e: unknown) {
      if (e instanceof Error) {
        this.serviceLogger.error(`Error on decodeTx: ${e.stack}`);
      }
      throw e;
    }
  }

  decodeSwaps(transaction: TransactionDto): SwapDtoNoId[] {
    /**
         find routes
         */
    try {
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
        throw new InvalidSwapException(
          CrocSwapDexDecoder.name,
          `[${transaction.hash}] No transaction.to found.`,
        );
      }
      const receipt = transaction.receipt;
      if (!receipt) {
        throw new InvalidSwapException(
          CrocSwapDexDecoder.name,
          `[${transaction.hash}] No receipt found.`,
        );
      }
      const logs = transaction.receipt?.logs;
      if (!logs) {
        throw new InvalidSwapException(
          CrocSwapDexDecoder.name,
          `[${transaction.hash}] No logs found.`,
        );
      }

      const validLogs = logs.filter(
        (
          log,
        ): log is LogDto & {
          topics: LogTopicDto[];
        } => {
          if (!log) {
            throw new InvalidSwapException(
              CrocSwapDexDecoder.name,
              `[${transaction.hash}] No log found.`,
            );
          }
          if (!log.topics) {
            throw new InvalidSwapException(
              CrocSwapDexDecoder.name,
              `[${log.logHash}] No log topic found.`,
            );
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
    } catch (e: unknown) {
      if (e instanceof Error) {
        this.serviceLogger.error(`Failed on decodeSwaps: ${transaction.hash}`);
      }

      throw e;
    }
  }

  // 0xbe6c65cf89e2c42171467fd69c3c8214d7618bf36aeb00743fded75415892420
  // 0xbccbf7ddcb291d1b599450677ba1707894149fe6b0dcd91038b2e191bcc86e17 - multi steps
  decodeETHToToken(args: DecodeArg<DecodedInputType>): SwapDtoNoId[] {
    const { transaction, logs, receipt, decoded, expectedRoutes, dex } = args;
    const { amount } = decoded;
    const fromToken = expectedRoutes[0];

    // first route, check correct amount in
    const isFromValid = transaction.value === amount;

    // first route, check correct amount out
    const toFirstTransferLog = logs.find((log) => {
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
        decodedTransfer.to === transaction.to &&
        decodedTransfer.tokenAddress === expectedRoutes[1]
      );
    });
    const isToValid = toFirstTransferLog != null;

    const isEverythingValid = isFromValid && isToValid;
    if (!isEverythingValid) {
      this.serviceLogger.error(
        `[${transaction.hash}] Invalid swap transaction. ${isFromValid ? 1 : 0}|${isToValid ? 1 : 0}`,
      );

      return [];
    }

    // check if there are enough routes' swaps (3 routes = 3 swaps)
    const swaps: SwapDtoNoId[] = decodeMultiStepSwaps({
      serviceLogger: this.serviceLogger,
      expectedRoutes,
      transaction,
      logs,
      receipt,
      dex,
      fromAndToIndex: [1, -1],
    });

    const decodedToTransfer = decodeTransferLog(
      toFirstTransferLog,
      toFirstTransferLog.topics,
    );
    if (decodedToTransfer == null) {
      throw new InvalidSwapException(
        CrocSwapDexDecoder.name,
        `[${transaction.hash}] decodedToTransfer is null`,
      );
    }

    const firstSwap: SwapDtoNoId = {
      blockNumber: transaction.blockNumber,
      transactionHash: transaction.hash,
      transactionIndex: receipt.transactionIndex,
      dex,
      from: fromToken,
      to: decodedToTransfer.tokenAddress,
      fromAmount: amount,
      toAmount: decodedToTransfer.value,
      createdAt: receipt.createdAt,
    };

    return [firstSwap, ...swaps];
  }

  // 0x60eb24bfb70978656e780988324d6082db6b28b0757671d7a09ada462545fb3b
  // 0x3d0472309aa88ddb31d30e012c31be33b302bc56c3e09fc97df277a0fbc66287 - multi steps
  decodeTokenToETH(args: DecodeArg<DecodedInputType>): SwapDtoNoId[] {
    const { transaction, logs, receipt, decoded, expectedRoutes, dex } = args;
    const { amount, minOut } = decoded;
    const fromToken = expectedRoutes[0];
    const toToken = expectedRoutes[expectedRoutes.length - 1];

    const isMultipleSteps = expectedRoutes.length > 2;
    if (!isMultipleSteps) {
      const fromTransferLog = getFromTransferLog({
        logs,
        amount: amount,
        fromToken: fromToken,
        from: dex,
      });
      const isFromValid = fromTransferLog != null;
      const toTransferLog = getETHTransferToLog(transaction, logs, minOut);
      const isToValid = toTransferLog != null;

      const isEverythingValid = isFromValid && isToValid;
      if (!isEverythingValid) {
        this.serviceLogger.error(
          `[${transaction.hash}] Invalid swap transaction. ${isFromValid ? 1 : 0}|${isToValid ? 1 : 0}`,
        );

        return [];
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
          `[${transaction.hash}] decodedToTransfer is null`,
        );
      }

      return [
        {
          blockNumber: transaction.blockNumber,
          transactionHash: transaction.hash,
          transactionIndex: receipt.transactionIndex,
          dex,
          from: decodedFromTransfer.tokenAddress,
          to: toToken,
          fromAmount: decodedFromTransfer.value,
          toAmount: decodedToTransfer.value,
          createdAt: receipt.createdAt,
        },
      ];
    }

    // check if there are enough routes' swaps (3 routes = 3 swaps)
    const swaps: SwapDtoNoId[] = decodeMultiStepSwaps({
      serviceLogger: this.serviceLogger,
      expectedRoutes,
      transaction,
      logs,
      receipt,
      dex,
      fromAndToIndex: [0, -2],
    });

    const fromLastTransferLog = getFromTransferLog({
      logs,
      amount: swaps[swaps.length - 1].toAmount,
      fromToken: swaps[swaps.length - 1].to,
      from: dex,
    });

    const firstSwap = swaps[0];
    const isFromValid =
      firstSwap.from === fromToken && firstSwap.fromAmount === amount;
    const toTransferLog = getETHTransferToLog(transaction, logs, minOut);
    const isToValid = fromLastTransferLog != null && toTransferLog != null;

    const isEverythingValid = isFromValid && isToValid;
    if (!isEverythingValid) {
      this.serviceLogger.error(
        `[${transaction.hash}] Invalid swap transaction. ${isFromValid ? 1 : 0}|${isToValid ? 1 : 0}`,
      );

      return [];
    }

    const decodedFromTransfer = decodeTransferLog(
      fromLastTransferLog,
      fromLastTransferLog.topics,
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
        `[${transaction.hash}] decodedToTransfer is null`,
      );
    }

    const lastSwap: SwapDtoNoId = {
      blockNumber: transaction.blockNumber,
      transactionHash: transaction.hash,
      transactionIndex: receipt.transactionIndex,
      dex,
      from: decodedFromTransfer.tokenAddress,
      to: toToken,
      fromAmount: decodedFromTransfer.value,
      toAmount: decodedToTransfer.value,
      createdAt: receipt.createdAt,
    };

    return [...swaps, lastSwap];
  }

  // 0xc3dbae551ebcf7bf3d54817e228b451a585e583262a263e1e1cc4c81b5d4fd1d
  // 0x6814caa14d45596a32c04de1b10064839c0155f7b1c960d5ade5312111f81c3d - multiple steps
  decodeTokenToToken(args: DecodeArg<DecodedInputType>): SwapDtoNoId[] {
    const { transaction, logs, receipt, decoded, expectedRoutes, dex } = args;
    const { amount, minOut } = decoded;
    const fromToken = expectedRoutes[0];
    const toToken = expectedRoutes[expectedRoutes.length - 1];

    // first route, check correct amount in
    const fromTransferLog = getFromTransferLog({
      logs,
      amount,
      fromToken,
      from: transaction.from,
    });
    const isFromValid = fromTransferLog != null;

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

    const isEverythingValid = isFromValid && isToValid;
    if (!isEverythingValid) {
      this.serviceLogger.error(
        `[${transaction.hash}] Invalid swap transaction. ${isFromValid ? 1 : 0}|${isToValid ? 1 : 0}`,
      );

      return [];
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
        `[${transaction.hash}] decodedToTransfer is null`,
      );
    }

    // check if there are enough routes' swaps (3 routes = 3 swaps)
    return decodeMultiStepSwaps({
      serviceLogger: this.serviceLogger,
      expectedRoutes,
      transaction,
      logs,
      receipt,
      dex,
      fromAndToIndex: [0, -1],
    });
  }
}
