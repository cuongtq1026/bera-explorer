import { BERA_DEX_ADDRESS } from "../config/constants.ts";
import { BeraCopyTradingDex } from "./bera-copy-trading-dex.ts";
import type { CopyTradingDEX } from "./copy-trading-dex.abstract.ts";

const copyTradingDexMap = new Map<string, CopyTradingDEX>();

export function getCopyTradingDex(dexAddress: string): CopyTradingDEX {
  const copyTradingDex = copyTradingDexMap.get(dexAddress);
  if (copyTradingDex) {
    return copyTradingDex;
  }

  switch (dexAddress) {
    case BERA_DEX_ADDRESS: {
      const copyTradingBeraDEX = new BeraCopyTradingDex();
      copyTradingDexMap.set(dexAddress, copyTradingBeraDEX);

      return copyTradingBeraDEX;
    }
  }
  throw new Error(`Unknown dex address ${dexAddress}`);
}
