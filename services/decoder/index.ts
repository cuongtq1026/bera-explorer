import { CROC_SWAP_DEX_MULTI_SWAP } from "../config/constants.ts";
import { CrocSwapDexDecoder } from "./croc-swap-dex.decoder.ts";
import type { SwapDecoder } from "./interface.decoder.ts";

const CrocSwapDexDecoderInstance = new CrocSwapDexDecoder();

export function getDecoder(signature: string): SwapDecoder | null {
  switch (signature) {
    // only support croc swap dex for now
    case CROC_SWAP_DEX_MULTI_SWAP: {
      return CrocSwapDexDecoderInstance;
    }
    default: {
      return null;
    }
  }
}
