import type { PriceDto, SwapDto } from "@database/dto.ts";
import {
  createPricesAndReturn,
  deletePrices,
  type PriceCreateInput,
} from "@database/repositories/price.repository.ts";
import { getSwap } from "@database/repositories/swap.repository.ts";
import Decimal from "decimal.js";

import {
  getStableCoinOneDecimalValue,
  isETH,
  isStableCoin,
  ONE_ETH_VALUE,
  ONE_USD_VALUE,
  ZERO_DECIMAL_VALUE,
} from "../config/constants.ts";
import { NoGetResult } from "../exceptions/processor.exception.ts";
import { appLogger } from "../monitor/app.logger.ts";
import { AbstractProcessor } from "./abstract.processor.ts";

const serviceLogger = appLogger.namespace("PriceProcessor");

export class PriceProcessor extends AbstractProcessor<
  number | bigint,
  SwapDto,
  PriceCreateInput[],
  PriceDto[]
> {
  constructor() {
    super({
      logger: appLogger.namespace(PriceProcessor.name),
    });
  }

  async get(swapId: number | bigint): Promise<SwapDto> {
    const swapDto = await getSwap(swapId);
    if (swapDto == null) {
      throw new NoGetResult(swapId.toString());
    }
    return swapDto;
  }

  toInput(swapDto: SwapDto): PriceCreateInput[] {
    {
      // undetermined swap is both from and to are not usd, eth or btc
      const prices = checkAndGetUndeterminedPrice(swapDto);
      if (prices !== null) {
        return prices;
      }
    }

    /** Calculate prices */
    return calculatePrices(swapDto);
  }

  async deleteFromDb(swapId: number | bigint): Promise<void> {
    await deletePrices(swapId);
  }

  async createInDb(inputs: PriceCreateInput[]): Promise<PriceDto[]> {
    return await createPricesAndReturn(inputs);
  }

  async process(swapId: number | bigint): Promise<PriceDto[]> {
    serviceLogger.info("[PriceProcessor] processing: " + swapId);

    const obj = await this.get(swapId);

    const inputs = this.toInput(obj);

    await this.deleteFromDb(swapId);
    serviceLogger.info(`[PriceProcessor] deleted prices swapId ${swapId}`);
    const prices = await this.createInDb(inputs);
    serviceLogger.info(`[PriceProcessor] created prices swapId ${swapId}`);

    return prices;
  }
}

/**
 * Check if swap is not related to usd, eth and btc. If so, return price as "0" for all
 * @param swap
 */
function checkAndGetUndeterminedPrice(
  swap: SwapDto,
): [PriceCreateInput, PriceCreateInput] | null {
  const isFromStableCoin = isStableCoin(swap.from);
  const isToStableCoin = isStableCoin(swap.to);

  const isFromETH = isETH(swap.from);
  const isToETH = isETH(swap.to);

  if (!isFromStableCoin && !isToStableCoin && !isFromETH && !isToETH) {
    return [
      {
        hash: `${swap.id}-1`,
        swapId: swap.id,
        blockNumber: swap.blockNumber,
        tokenAddress: swap.from,
        transactionHash: swap.transactionHash,
        transactionIndex: swap.transactionIndex,
        usd_price: "0",
        ethPrice: "0",
        createdAt: swap.createdAt,
      },
      {
        hash: `${swap.id}-2`,
        swapId: swap.id,
        blockNumber: swap.blockNumber,
        tokenAddress: swap.to,
        transactionHash: swap.transactionHash,
        transactionIndex: swap.transactionIndex,
        usd_price: "0",
        ethPrice: "0",
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

function calculatePrices(swap: SwapDto) {
  const fromTokenPrice: PriceCreateInput = {
    hash: `${swap.id}-1`,
    swapId: swap.id,
    blockNumber: swap.blockNumber,
    tokenAddress: swap.from,
    transactionHash: swap.transactionHash,
    transactionIndex: swap.transactionIndex,
    usd_price: getUsdPrice({
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
    createdAt: swap.createdAt,
  };
  const toTokenPrice: PriceCreateInput = {
    hash: `${swap.id}-2`,
    swapId: swap.id,
    blockNumber: swap.blockNumber,
    tokenAddress: swap.to,
    transactionHash: swap.transactionHash,
    transactionIndex: swap.transactionIndex,
    usd_price: getUsdPrice({
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
    createdAt: swap.createdAt,
  };
  return [fromTokenPrice, toTokenPrice];
}
