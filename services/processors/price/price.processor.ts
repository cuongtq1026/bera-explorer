import type { PriceDto, SwapDto } from "@database/dto.ts";
import {
  createPricesAndReturn,
  deletePrices,
  type PriceCreateInput,
} from "@database/repositories/price.repository.ts";
import { getSwap } from "@database/repositories/swap.repository.ts";
import {
  calculatePrices,
  checkAndGetUndeterminedPrice,
} from "@processors/price/price.processor.utils.ts";

import { NoGetResult } from "../../exceptions/processor.exception.ts";
import { appLogger } from "../../monitor/app.logger.ts";
import { AbstractProcessor } from "../abstract.processor.ts";

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
