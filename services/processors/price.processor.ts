import type { SwapDto } from "@database/dto.ts";
import {
  createPrices,
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
  bigint,
  SwapDto,
  PriceCreateInput[]
> {
  constructor() {
    super({
      logger: appLogger.namespace(PriceProcessor.name),
    });
  }

  async get(swapId: bigint): Promise<SwapDto> {
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
          swapId: swapDto.id,
          tokenAddress: swapDto.from,
          transactionHash: swapDto.transactionHash,
          usd_price: "0",
          createdAt: swapDto.createdAt,
        },
        {
          swapId: swapDto.id,
          tokenAddress: swapDto.to,
          transactionHash: swapDto.transactionHash,
          usd_price: "0",
          createdAt: swapDto.createdAt,
        },
      ];
    }

    /*
            Calculate prices
             */
    const fromDecimal = new Decimal(swapDto.fromAmount.toString());
    const toDecimal = new Decimal(swapDto.toAmount.toString());
    const fromTokenPrice: PriceCreateInput = {
      swapId: swapDto.id,
      tokenAddress: swapDto.from,
      transactionHash: swapDto.transactionHash,
      usd_price: isFromStableCoin
        ? // return 1 if the token is stable coin
          ONE_USD.toString()
        : swapDto.toAmount === 0n
          ? "0"
          : fromDecimal
              .div(toDecimal)
              .mul(new Decimal(10).pow(getStableCoin(swapDto.to)!.decimals))
              .toString(),
      createdAt: swapDto.createdAt,
    };
    const toTokenPrice: PriceCreateInput = {
      swapId: swapDto.id,
      tokenAddress: swapDto.to,
      transactionHash: swapDto.transactionHash,
      usd_price: isToStableCoin
        ? // return 1 if the token is stable coin
          ONE_USD.toString()
        : swapDto.fromAmount === 0n
          ? "0"
          : toDecimal
              .div(fromDecimal)
              .mul(new Decimal(10).pow(getStableCoin(swapDto.to)!.decimals))
              .toString(),
      createdAt: swapDto.createdAt,
    };
    return [fromTokenPrice, toTokenPrice];
  }

  async deleteFromDb(swapId: bigint): Promise<void> {
    await deletePrices(swapId);
  }

  async createInDb(inputs: PriceCreateInput[]): Promise<void> {
    await createPrices(inputs);
  }

  async process(swapId: bigint): Promise<void> {
    serviceLogger.info("[PriceProcessor] processing: " + swapId);

    const obj = await this.get(swapId);

    const inputs = this.toInput(obj);

    await this.deleteFromDb(swapId);
    serviceLogger.info(`[PriceProcessor] deleted ${swapId}`);
    await this.createInDb(inputs);
    serviceLogger.info(`[PriceProcessor] created ${swapId}`);
  }
}
