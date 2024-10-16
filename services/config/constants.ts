import {
  type AbiFunction,
  getAbiItem,
  toEventSelector,
  toFunctionSelector,
} from "viem";

import CrocMultiSwapABI from "./abis/CrocMultiSwap.abi.json";

// 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
export const ERC20_TRANSFER_SIGNATURE = toEventSelector(
  "Transfer(address,address,uint256)",
);

export const CONTRACT_INITIATED_SIGNATURE = toEventSelector(
  "Initialized(uint64 version)",
);

export const CROC_SWAP_DEX_MULTI_SWAP = toFunctionSelector(
  getAbiItem({
    abi: CrocMultiSwapABI,
    name: "multiSwap",
  }) as AbiFunction,
);
