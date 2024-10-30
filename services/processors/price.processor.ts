import type { PriceDto, SwapDto } from "@database/dto.ts";
import {
  createPricesAndReturn,
  deletePrices,
  type PriceCreateInput,
} from "@database/repositories/price.repository.ts";
import { getSwap } from "@database/repositories/swap.repository.ts";
import Decimal from "decimal.js";

import { getStableCoin, isStableCoin, ONE_USD } from "../config/constants.ts";
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
    const isFromStableCoin = isStableCoin(swapDto.from);
    const isToStableCoin = isStableCoin(swapDto.to);

    // TODO: Getting usd_price by checking all swaps in the whole block
    // return both 0 if non of them is stable coin for now
    if (!isFromStableCoin && !isToStableCoin) {
      return [
        {
          hash: `${swapDto.id}-1`,
          swapId: swapDto.id,
          blockNumber: swapDto.blockNumber,
          tokenAddress: swapDto.from,
          transactionHash: swapDto.transactionHash,
          transactionIndex: swapDto.transactionIndex,
          usd_price: "0",
          createdAt: swapDto.createdAt,
        },
        {
          hash: `${swapDto.id}-2`,
          swapId: swapDto.id,
          blockNumber: swapDto.blockNumber,
          tokenAddress: swapDto.to,
          transactionHash: swapDto.transactionHash,
          transactionIndex: swapDto.transactionIndex,
          usd_price: "0",
          createdAt: swapDto.createdAt,
        },
      ];
    }

    /** Calculate prices */
    const fromDecimal = new Decimal(swapDto.fromAmount.toString());
    const toDecimal = new Decimal(swapDto.toAmount.toString());
    const fromTokenPrice: PriceCreateInput = {
      hash: `${swapDto.id}-1`,
      swapId: swapDto.id,
      blockNumber: swapDto.blockNumber,
      tokenAddress: swapDto.from,
      transactionHash: swapDto.transactionHash,
      transactionIndex: swapDto.transactionIndex,
      usd_price: isFromStableCoin
        ? // return 1 if the token is stable coin
          ONE_USD.toString()
        : swapDto.toAmount === 0n
          ? "0"
          : toDecimal
              .div(fromDecimal)
              .mul(new Decimal(10).pow(getStableCoin(swapDto.to)!.decimals))
              .toString(),
      createdAt: swapDto.createdAt,
    };
    const toTokenPrice: PriceCreateInput = {
      hash: `${swapDto.id}-2`,
      swapId: swapDto.id,
      blockNumber: swapDto.blockNumber,
      tokenAddress: swapDto.to,
      transactionHash: swapDto.transactionHash,
      transactionIndex: swapDto.transactionIndex,
      usd_price: isToStableCoin
        ? // return 1 if the token is stable coin
          ONE_USD.toString()
        : swapDto.fromAmount === 0n
          ? "0"
          : fromDecimal
              .div(toDecimal)
              .mul(new Decimal(10).pow(getStableCoin(swapDto.from)!.decimals))
              .toString(),
      createdAt: swapDto.createdAt,
    };
    return [fromTokenPrice, toTokenPrice];
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
