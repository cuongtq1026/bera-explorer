import type { PriceDto, SwapDto } from "@database/dto.ts";
import prisma from "@database/prisma.ts";
import Decimal from "decimal.js";

import {
  isBTC,
  isETH,
  isStableCoin,
  ONE_BTC_VALUE,
  ONE_ETH_VALUE,
  ONE_USD_VALUE,
} from "../../../../config/constants.ts";
import { AppLogger } from "../../../../monitor/app.logger.ts";
import { parseDecimalToBigInt } from "../../../../utils.ts";

/**
 * Bridges usd prices within a single swap
 * @param prices Array of PriceDto belonging to the same swap
 * @returns Array of PriceDto with bridged USD prices
 */
// TODO: Handle immutable
export function bridgeUsdSwapPrices(
  prices: (PriceDto & {
    swap: SwapDto;
  })[],
): (PriceDto & {
  swap: SwapDto;
})[] {
  if (!prices.length) return [];

  const bridgedPrices: (PriceDto & {
    swap: SwapDto;
  })[] = [];
  const knownUsdPrices = new Map<string, Decimal>();

  // First pass: collect known USD prices
  prices.forEach((price) => {
    if (isStableCoin(price.tokenAddress)) {
      knownUsdPrices.set(price.tokenAddress, ONE_USD_VALUE);
    } else if (price.usdPrice) {
      knownUsdPrices.set(
        price.tokenAddress,
        new Decimal(price.usdPrice.toString()),
      );
    }
  });

  // Second pass: bridge prices using known values
  prices.forEach((price) => {
    const updatedPrice = { ...price };

    if (!price.usdPrice && knownUsdPrices.has(price.tokenAddress)) {
      const knownPrice = knownUsdPrices.get(price.tokenAddress);
      if (knownPrice) {
        updatedPrice.usdPrice = parseDecimalToBigInt(knownPrice);
      }
    }

    // If this is part of a swap, try to calculate price using swap ratios
    if (updatedPrice.swap && !updatedPrice.usdPrice) {
      const swap = updatedPrice.swap;
      const fromPrice = knownUsdPrices.get(swap.from);
      const toPrice = knownUsdPrices.get(swap.to);

      if (fromPrice) {
        const ratio = new Decimal(swap.toAmount.toString()).div(
          new Decimal(swap.fromAmount.toString()),
        );
        const calculatedPrice = fromPrice.div(ratio);
        updatedPrice.usdPrice = parseDecimalToBigInt(calculatedPrice);
        knownUsdPrices.set(swap.to, calculatedPrice);
      } else if (toPrice) {
        const ratio = new Decimal(swap.fromAmount.toString()).div(
          new Decimal(swap.toAmount.toString()),
        );
        const calculatedPrice = toPrice.div(ratio);
        updatedPrice.usdPrice = parseDecimalToBigInt(calculatedPrice);
        knownUsdPrices.set(swap.from, calculatedPrice);
      }
    }

    bridgedPrices.push(updatedPrice);
  });

  return bridgedPrices;
}

/**
 * Bridges eth prices within a single swap
 * @param prices Array of PriceDto belonging to the same swap
 * @returns Array of PriceDto with bridged ETH prices
 */
export function bridgeETHSwapPrices(
  prices: (PriceDto & {
    swap: SwapDto;
  })[],
): (PriceDto & {
  swap: SwapDto;
})[] {
  if (!prices.length) return [];

  const bridgedPrices: (PriceDto & {
    swap: SwapDto;
  })[] = [];
  const knownEthPrices = new Map<string, Decimal>();

  // First pass: collect known USD prices
  prices.forEach((price) => {
    if (isETH(price.tokenAddress)) {
      knownEthPrices.set(price.tokenAddress, ONE_ETH_VALUE);
    } else if (price.ethPrice) {
      knownEthPrices.set(
        price.tokenAddress,
        new Decimal(price.ethPrice.toString()),
      );
    }
  });

  console.log("knownEthPrices", knownEthPrices);

  // Second pass: bridge prices using known values
  prices.forEach((price) => {
    const updatedPrice = { ...price };

    if (!price.ethPrice && knownEthPrices.has(price.tokenAddress)) {
      const knownPrice = knownEthPrices.get(price.tokenAddress);
      if (knownPrice) {
        updatedPrice.ethPrice = parseDecimalToBigInt(knownPrice);
      }
    }

    // If this is part of a swap, try to calculate price using swap ratios
    if (updatedPrice.swap && !updatedPrice.ethPrice) {
      const swap = updatedPrice.swap;
      const fromPrice = knownEthPrices.get(swap.from);
      const toPrice = knownEthPrices.get(swap.to);

      if (fromPrice) {
        const ratio = new Decimal(swap.toAmount.toString()).div(
          new Decimal(swap.fromAmount.toString()),
        );
        const calculatedPrice = fromPrice.div(ratio);
        updatedPrice.ethPrice = parseDecimalToBigInt(calculatedPrice);
        knownEthPrices.set(swap.to, calculatedPrice);
      } else if (toPrice) {
        const ratio = new Decimal(swap.fromAmount.toString()).div(
          new Decimal(swap.toAmount.toString()),
        );
        const calculatedPrice = toPrice.div(ratio);
        updatedPrice.ethPrice = parseDecimalToBigInt(calculatedPrice);
        knownEthPrices.set(swap.from, calculatedPrice);
      }
    }

    bridgedPrices.push(updatedPrice);
  });

  return bridgedPrices;
}

/**
 * Bridges btc prices within a single swap
 * @param prices Array of PriceDto belonging to the same swap
 * @returns Array of PriceDto with bridged btc prices
 */
export function bridgeBtcSwapPrices(
  prices: (PriceDto & {
    swap: SwapDto;
  })[],
): (PriceDto & {
  swap: SwapDto;
})[] {
  if (!prices.length) return [];

  const bridgedPrices: (PriceDto & {
    swap: SwapDto;
  })[] = [];
  const knownBtcPrices = new Map<string, Decimal>();

  // First pass: collect known USD prices
  prices.forEach((price) => {
    if (isBTC(price.tokenAddress)) {
      knownBtcPrices.set(price.tokenAddress, ONE_BTC_VALUE);
    } else if (price.btcPrice) {
      knownBtcPrices.set(
        price.tokenAddress,
        new Decimal(price.btcPrice.toString()),
      );
    }
  });

  // Second pass: bridge prices using known values
  prices.forEach((price) => {
    const updatedPrice = { ...price };

    if (!price.btcPrice && knownBtcPrices.has(price.tokenAddress)) {
      const knownPrice = knownBtcPrices.get(price.tokenAddress);
      if (knownPrice) {
        updatedPrice.btcPrice = parseDecimalToBigInt(knownPrice);
      }
    }

    // If this is part of a swap, try to calculate price using swap ratios
    if (updatedPrice.swap && !updatedPrice.btcPrice) {
      const swap = updatedPrice.swap;
      const fromPrice = knownBtcPrices.get(swap.from);
      const toPrice = knownBtcPrices.get(swap.to);

      if (fromPrice) {
        const ratio = new Decimal(swap.toAmount.toString()).div(
          new Decimal(swap.fromAmount.toString()),
        );
        const calculatedPrice = fromPrice.div(ratio);
        updatedPrice.btcPrice = parseDecimalToBigInt(calculatedPrice);
        knownBtcPrices.set(swap.to, calculatedPrice);
      } else if (toPrice) {
        const ratio = new Decimal(swap.fromAmount.toString()).div(
          new Decimal(swap.toAmount.toString()),
        );
        const calculatedPrice = toPrice.div(ratio);
        updatedPrice.btcPrice = parseDecimalToBigInt(calculatedPrice);
        knownBtcPrices.set(swap.from, calculatedPrice);
      }
    }

    bridgedPrices.push(updatedPrice);
  });

  return bridgedPrices;
}

export async function fillInUsdPrice(args: {
  blockNumber: number | bigint;
  serviceLogger: AppLogger;
  prices: (PriceDto & {
    swap: SwapDto;
  })[];
}) {
  const { prices, serviceLogger, blockNumber } = args;
  for (const price of prices) {
    if (price.usdPrice !== 0n) {
      continue;
    }
    serviceLogger.debug(
      `[Price: ${price.hash}] usdPrice is 0. Filling in by the other side of the swap.`,
    );
    // try to get price from other side of the swap
    const isFrom = price.swap.from === price.tokenAddress;
    const swapToken = isFrom ? price.swap.to : price.swap.from;
    const swapTokenPrice = await prisma.erc20Price.findFirst({
      where: {
        tokenAddress: swapToken,
        blockNumber,
      },
      orderBy: [
        {
          blockNumber: "desc",
        },
        { transactionIndex: "desc" },
      ],
    });
    // if the other side of the swap token has price, use it
    if (swapTokenPrice != null && !swapTokenPrice.usdPrice.eq(0)) {
      // calculate price
      const fromAmount = new Decimal(price.swap.fromAmount.toString());
      const toAmount = new Decimal(price.swap.toAmount.toString());
      const ratio = isFrom
        ? toAmount.div(fromAmount)
        : fromAmount.div(toAmount);
      const calculatedPrice = swapTokenPrice.usdPrice.mul(ratio);

      price.usdPrice = parseDecimalToBigInt(calculatedPrice);
      price.usdPriceRefHash = swapTokenPrice.hash;

      continue;
    }

    serviceLogger.debug(
      `[Price: ${price.hash}] The other side of the swap doesn't have price. Use the previous price.`,
    );
    // if not, use the previous price
    const previousPrice = await prisma.erc20Price.findFirst({
      where: {
        tokenAddress: price.tokenAddress,
        blockNumber: {
          lt: blockNumber,
        },
      },
      orderBy: [
        {
          blockNumber: "desc",
        },
        { transactionIndex: "desc" },
      ],
    });
    // if the previous price has price, use it
    if (previousPrice != null && !previousPrice.usdPrice.eq(0)) {
      price.usdPrice = parseDecimalToBigInt(previousPrice.usdPrice);
      price.usdPriceRefHash = previousPrice.hash;

      continue;
    }

    // if not, use the previous swap price
    serviceLogger.debug(
      `[Price: ${price.hash}] There's not previous price. Use the previous price of the other side of the swap.`,
    );
    const previousPriceSwapToken = await prisma.erc20Price.findFirst({
      where: {
        tokenAddress: swapToken,
        blockNumber: {
          lt: blockNumber,
        },
      },
      orderBy: [
        {
          blockNumber: "desc",
        },
        { transactionIndex: "desc" },
      ],
    });
    if (
      previousPriceSwapToken == null ||
      previousPriceSwapToken.usdPrice.eq(0)
    ) {
      // there's no price for both of them, might both of them be new tokens
      continue;
    }
    // calculate price
    const fromAmount = new Decimal(price.swap.fromAmount.toString());
    const toAmount = new Decimal(price.swap.toAmount.toString());
    const ratio = isFrom ? toAmount.div(fromAmount) : fromAmount.div(toAmount);
    const calculatedPrice = previousPriceSwapToken.usdPrice.mul(ratio);

    price.usdPrice = parseDecimalToBigInt(calculatedPrice);
    price.usdPriceRefHash = previousPriceSwapToken.hash;
  }
}

export async function fillInEthPrice(args: {
  blockNumber: number | bigint;
  serviceLogger: AppLogger;
  prices: (PriceDto & {
    swap: SwapDto;
  })[];
}) {
  const { prices, serviceLogger, blockNumber } = args;
  for (const price of prices) {
    if (price.ethPrice !== 0n) {
      continue;
    }
    serviceLogger.debug(
      `[Price: ${price.hash}] ethPrice is 0. Filling in by the other side of the swap.`,
    );
    // try to get price from other side of the swap
    const isFrom = price.swap.from === price.tokenAddress;
    const swapToken = isFrom ? price.swap.to : price.swap.from;
    const swapTokenPrice = await prisma.erc20Price.findFirst({
      where: {
        tokenAddress: swapToken,
        blockNumber,
      },
      orderBy: [
        {
          blockNumber: "desc",
        },
        { transactionIndex: "desc" },
      ],
    });
    // if the other side of the swap token has price, use it
    if (swapTokenPrice != null && !swapTokenPrice.ethPrice.eq(0)) {
      // calculate price
      const fromAmount = new Decimal(price.swap.fromAmount.toString());
      const toAmount = new Decimal(price.swap.toAmount.toString());
      const ratio = isFrom
        ? toAmount.div(fromAmount)
        : fromAmount.div(toAmount);
      const calculatedPrice = swapTokenPrice.ethPrice.mul(ratio);

      price.ethPrice = parseDecimalToBigInt(calculatedPrice);
      price.ethPriceRefHash = swapTokenPrice.hash;

      continue;
    }

    serviceLogger.debug(
      `[Price: ${price.hash}] The other side of the swap doesn't have ethPrice. Use the previous ethPrice.`,
    );
    // if not, use the previous price
    const previousPrice = await prisma.erc20Price.findFirst({
      where: {
        tokenAddress: price.tokenAddress,
        blockNumber: {
          lt: blockNumber,
        },
      },
      orderBy: [
        {
          blockNumber: "desc",
        },
        { transactionIndex: "desc" },
      ],
    });
    // if the previous price has price, use it
    if (previousPrice != null && !previousPrice.ethPrice.eq(0)) {
      price.ethPrice = parseDecimalToBigInt(previousPrice.ethPrice);
      price.ethPriceRefHash = previousPrice.hash;

      continue;
    }

    // if not, use the previous swap eth price
    serviceLogger.debug(
      `[Price: ${price.hash}] There's not previous eth price. Use the previous eth price of the other side of the swap.`,
    );
    const previousPriceSwapToken = await prisma.erc20Price.findFirst({
      where: {
        tokenAddress: swapToken,
        blockNumber: {
          lt: blockNumber,
        },
      },
      orderBy: [
        {
          blockNumber: "desc",
        },
        { transactionIndex: "desc" },
      ],
    });
    if (
      previousPriceSwapToken == null ||
      previousPriceSwapToken.ethPrice.eq(0)
    ) {
      // there's no price for both of them, might both of them be new tokens
      continue;
    }
    // calculate price
    const fromAmount = new Decimal(price.swap.fromAmount.toString());
    const toAmount = new Decimal(price.swap.toAmount.toString());
    const ratio = isFrom ? toAmount.div(fromAmount) : fromAmount.div(toAmount);
    const calculatedPrice = previousPriceSwapToken.ethPrice.mul(ratio);

    price.ethPrice = parseDecimalToBigInt(calculatedPrice);
    price.ethPriceRefHash = previousPriceSwapToken.hash;
  }
}

export async function fillInBtcPrice(args: {
  blockNumber: number | bigint;
  serviceLogger: AppLogger;
  prices: (PriceDto & {
    swap: SwapDto;
  })[];
}) {
  const { prices, serviceLogger, blockNumber } = args;
  for (const price of prices) {
    if (price.btcPrice !== 0n) {
      continue;
    }
    serviceLogger.debug(
      `[Price: ${price.hash}] btcPrice is 0. Filling in by the other side of the swap.`,
    );
    // try to get price from other side of the swap
    const isFrom = price.swap.from === price.tokenAddress;
    const swapToken = isFrom ? price.swap.to : price.swap.from;
    const swapTokenPrice = await prisma.erc20Price.findFirst({
      where: {
        tokenAddress: swapToken,
        blockNumber,
      },
      orderBy: [
        {
          blockNumber: "desc",
        },
        { transactionIndex: "desc" },
      ],
    });
    // if the other side of the swap token has price, use it
    if (swapTokenPrice != null && !swapTokenPrice.btcPrice.eq(0)) {
      // calculate price
      const fromAmount = new Decimal(price.swap.fromAmount.toString());
      const toAmount = new Decimal(price.swap.toAmount.toString());
      const ratio = isFrom
        ? toAmount.div(fromAmount)
        : fromAmount.div(toAmount);
      const calculatedPrice = swapTokenPrice.btcPrice.mul(ratio);

      price.btcPrice = parseDecimalToBigInt(calculatedPrice);
      price.btcPriceRefHash = swapTokenPrice.hash;

      continue;
    }

    serviceLogger.debug(
      `[Price: ${price.hash}] The other side of the swap doesn't have btc price. Use the previous btc price.`,
    );
    // if not, use the previous price
    const previousPrice = await prisma.erc20Price.findFirst({
      where: {
        tokenAddress: price.tokenAddress,
        blockNumber: {
          lt: blockNumber,
        },
      },
      orderBy: [
        {
          blockNumber: "desc",
        },
        { transactionIndex: "desc" },
      ],
    });
    // if the previous price has price, use it
    if (previousPrice != null && !previousPrice.btcPrice.eq(0)) {
      price.btcPrice = parseDecimalToBigInt(previousPrice.btcPrice);
      price.btcPriceRefHash = previousPrice.hash;

      continue;
    }

    // if not, use the previous swap price
    serviceLogger.debug(
      `[Price: ${price.hash}] There's not previous btc price. Use the previous btc price of the other side of the swap.`,
    );
    const previousPriceSwapToken = await prisma.erc20Price.findFirst({
      where: {
        tokenAddress: swapToken,
        blockNumber: {
          lt: blockNumber,
        },
      },
      orderBy: [
        {
          blockNumber: "desc",
        },
        { transactionIndex: "desc" },
      ],
    });
    if (
      previousPriceSwapToken == null ||
      previousPriceSwapToken.btcPrice.eq(0)
    ) {
      // there's no price for both of them, might both of them be new tokens
      continue;
    }
    // calculate price
    const fromAmount = new Decimal(price.swap.fromAmount.toString());
    const toAmount = new Decimal(price.swap.toAmount.toString());
    const ratio = isFrom ? toAmount.div(fromAmount) : fromAmount.div(toAmount);
    const calculatedPrice = previousPriceSwapToken.btcPrice.mul(ratio);

    price.btcPrice = parseDecimalToBigInt(calculatedPrice);
    price.btcPriceRefHash = previousPriceSwapToken.hash;
  }
}
