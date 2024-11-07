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
  string,
  SwapDto,
  PriceCreateInput[],
  PriceDto[]
> {
  constructor() {
    super({
      logger: appLogger.namespace(PriceProcessor.name),
    });
  }

  async get(swapHash: string): Promise<SwapDto> {
    const swapDto = await getSwap(swapHash);
    if (swapDto == null) {
      throw new NoGetResult(swapHash.toString());
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

  async deleteFromDb(swapHash: string): Promise<void> {
    await deletePrices(swapHash);
  }

  async createInDb(inputs: PriceCreateInput[]): Promise<PriceDto[]> {
    return await createPricesAndReturn(inputs);
  }

  async process(swapHash: string): Promise<PriceDto[]> {
    serviceLogger.info("[PriceProcessor] processing: " + swapHash);

    const obj = await this.get(swapHash);

    const inputs = this.toInput(obj);

    await this.deleteFromDb(swapHash);
    serviceLogger.info(`[PriceProcessor] deleted prices swapHash ${swapHash}`);
    const prices = await this.createInDb(inputs);
    serviceLogger.info(`[PriceProcessor] created prices swapHash ${swapHash}`);

    return prices;
  }
}
