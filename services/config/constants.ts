import type { TokenDto } from "@database/dto.ts";
import Decimal from "decimal.js";
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
export const WITHDRAWAL_SIGNATURE = toEventSelector(
  "Withdrawal(address indexed to, uint256 amount);",
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

export const ETH_ADDRESS = "0x0000000000000000000000000000000000000000";
export const WRAPPED_ETH_ADDRESS = "0x7507c1dc16935b82698e4c63f2746a2fcf994df8";

// Berachain as default
type Chain = {
  id: number;
  name: string;
  stableCoins: TokenDto[];
};
export const USD_DECIMAL = 18;
export const ONE_USD = new Decimal(10).pow(USD_DECIMAL);
export const CHAIN_ID = process.env.CHAIN_ID ? +process.env.CHAIN_ID : 80084;
export const chains: { [chainId: number]: Chain } = {
  "80084": {
    id: 80084,
    name: "Berachain",
    stableCoins: [
      {
        address: "0x0e4aaf1351de4c0264c5c7056ef3777b41bd8e03",
        name: "Honey Token",
        symbol: "HONEY",
        decimals: 18,
        totalSupply: 11737742132405135320233771727n,
      },
    ],
  },
};
export function isStableCoin(tokenAddress: string): boolean {
  const stableCoins = chains[CHAIN_ID].stableCoins;

  return stableCoins.some((stableCoin) => stableCoin.address === tokenAddress);
}
export function getStableCoin(tokenAddress: string): TokenDto | null {
  const stableCoins = chains[CHAIN_ID].stableCoins;

  const result = stableCoins.find(
    (stableCoin) => stableCoin.address === tokenAddress,
  );
  if (result == null) {
    return null;
  }
  return result;
}
