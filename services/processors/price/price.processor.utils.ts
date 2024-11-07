import type { SwapDto } from "@database/dto.ts";
import type { PriceCreateInput } from "@database/repositories/price.repository.ts";
import Decimal from "decimal.js";

import {
  getBtcOneDecimalValue,
  getStableCoinOneDecimalValue,
  isBTC,
  isETH,
  isStableCoin,
  ONE_BTC_VALUE,
  ONE_ETH_VALUE,
  ONE_USD_VALUE,
  ZERO_DECIMAL_VALUE,
} from "../../config/constants.ts";

/**
 * Check if swap is not related to usd, eth and btc. If so, return price as "0" for all
 * @param swap
 */
export function checkAndGetUndeterminedPrice(
  swap: SwapDto,
): [PriceCreateInput, PriceCreateInput] | null {
  const isFromStableCoin = isStableCoin(swap.from);
  const isToStableCoin = isStableCoin(swap.to);

  const isFromETH = isETH(swap.from);
  const isToETH = isETH(swap.to);

  if (!isFromStableCoin && !isToStableCoin && !isFromETH && !isToETH) {
    return [
      {
        hash: `${swap.hash}-1`,
        swapHash: swap.hash,
        blockNumber: swap.blockNumber,
        tokenAddress: swap.from,
        transactionHash: swap.transactionHash,
        transactionIndex: swap.transactionIndex,
        usdPrice: "0",
        ethPrice: "0",
        btcPrice: "0",
        createdAt: swap.createdAt,
      },
      {
        hash: `${swap.hash}-2`,
        swapHash: swap.hash,
        blockNumber: swap.blockNumber,
        tokenAddress: swap.to,
        transactionHash: swap.transactionHash,
        transactionIndex: swap.transactionIndex,
        usdPrice: "0",
        ethPrice: "0",
        btcPrice: "0",
        createdAt: swap.createdAt,
      },
    ];
  }

  return null;
}

function getUsdPrice(
  args: Pick<SwapDto, "from" | "to" | "fromAmount" | "toAmount">,
): Decimal {
  const { from: fromToken, to: toToken, fromAmount, toAmount } = args;
  if (isStableCoin(fromToken)) {
    return ONE_USD_VALUE;
  }
  if (toAmount === 0n || fromAmount === 0n) {
    return ZERO_DECIMAL_VALUE;
  }
  const toTokenStableCoinDecimal = getStableCoinOneDecimalValue(toToken);
  const isToStableCoin = toTokenStableCoinDecimal != null;
  if (!isToStableCoin) {
    // both from and to are not stable coins, return 0
    return ZERO_DECIMAL_VALUE;
  }

  const fromDecimal = new Decimal(fromAmount.toString());
  const toDecimal = new Decimal(toAmount.toString());
  return toDecimal.div(fromDecimal).mul(toTokenStableCoinDecimal);
}

function getEthPrice(
  args: Pick<SwapDto, "from" | "to" | "fromAmount" | "toAmount">,
): Decimal {
  const { from: fromToken, to: toToken, fromAmount, toAmount } = args;
  if (isETH(fromToken)) {
    return ONE_ETH_VALUE;
  }
  if (toAmount === 0n || fromAmount === 0n) {
    return ZERO_DECIMAL_VALUE;
  }
  if (!isETH(toToken)) {
    // both from and to are not eth, return 0
    return ZERO_DECIMAL_VALUE;
  }
  const fromDecimal = new Decimal(fromAmount.toString());
  const toDecimal = new Decimal(toAmount.toString());
  return toDecimal.div(fromDecimal).mul(ONE_ETH_VALUE);
}

function getBtcPrice(
  args: Pick<SwapDto, "from" | "to" | "fromAmount" | "toAmount">,
): Decimal {
  const { from: fromToken, to: toToken, fromAmount, toAmount } = args;
  if (isBTC(fromToken)) {
    return ONE_BTC_VALUE;
  }
  if (toAmount === 0n || fromAmount === 0n) {
    return ZERO_DECIMAL_VALUE;
  }
  const toTokenBtcDecimal = getBtcOneDecimalValue(toToken);
  const isToBtc = toTokenBtcDecimal != null;
  if (!isToBtc) {
    // both from and to are not stable coins, return 0
    return ZERO_DECIMAL_VALUE;
  }

  const fromDecimal = new Decimal(fromAmount.toString());
  const toDecimal = new Decimal(toAmount.toString());
  return toDecimal.div(fromDecimal).mul(toTokenBtcDecimal);
}

export function calculatePrices(swap: SwapDto) {
  const fromTokenPrice: PriceCreateInput = {
    hash: `${swap.hash}-1`,
    swapHash: swap.hash,
    blockNumber: swap.blockNumber,
    tokenAddress: swap.from,
    transactionHash: swap.transactionHash,
    transactionIndex: swap.transactionIndex,
    usdPrice: getUsdPrice({
      from: swap.from,
      to: swap.to,
      fromAmount: swap.fromAmount,
      toAmount: swap.toAmount,
    }).toString(),
    ethPrice: getEthPrice({
      from: swap.from,
      to: swap.to,
      fromAmount: swap.fromAmount,
      toAmount: swap.toAmount,
    }).toString(),
    btcPrice: getBtcPrice({
      from: swap.from,
      to: swap.to,
      fromAmount: swap.fromAmount,
      toAmount: swap.toAmount,
    }).toString(),
    createdAt: swap.createdAt,
  };
  const toTokenPrice: PriceCreateInput = {
    hash: `${swap.hash}-2`,
    swapHash: swap.hash,
    blockNumber: swap.blockNumber,
    tokenAddress: swap.to,
    transactionHash: swap.transactionHash,
    transactionIndex: swap.transactionIndex,
    usdPrice: getUsdPrice({
      from: swap.to,
      to: swap.from,
      fromAmount: swap.toAmount,
      toAmount: swap.fromAmount,
    }).toString(),
    ethPrice: getEthPrice({
      from: swap.to,
      to: swap.from,
      fromAmount: swap.toAmount,
      toAmount: swap.fromAmount,
    }).toString(),
    btcPrice: getBtcPrice({
      from: swap.to,
      to: swap.from,
      fromAmount: swap.toAmount,
      toAmount: swap.fromAmount,
    }).toString(),
    createdAt: swap.createdAt,
  };
  return [fromTokenPrice, toTokenPrice];
}
