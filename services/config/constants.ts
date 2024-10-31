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
type TokenDtoWithDecimal = TokenDto & {
  oneDecimalValue: Decimal;
};
type Chain = {
  id: number;
  name: string;
  stableCoinList: TokenDtoWithDecimal[];
  btcList: TokenDtoWithDecimal[];
};
export const ETH_DECIMAL = process.env.ETH_DECIMAL
  ? +process.env.ETH_DECIMAL
  : 18;
export const USD_DECIMAL = 18;
export const BTC_DECIMAL = 18;
export const ZERO_DECIMAL_VALUE = new Decimal(0);
export const ONE_USD_VALUE = new Decimal(10).pow(USD_DECIMAL);
export const ONE_BTC_VALUE = new Decimal(10).pow(BTC_DECIMAL);
export const ONE_ETH_VALUE = new Decimal(10).pow(ETH_DECIMAL);
export const CHAIN_ID = process.env.CHAIN_ID ? +process.env.CHAIN_ID : 80084;
export const chains: { [chainId: number]: Chain } = {
  "80084": {
    id: 80084,
    name: "Berachain",
    stableCoinList: [
      {
        address: "0x0e4aaf1351de4c0264c5c7056ef3777b41bd8e03",
        name: "Honey Token",
        symbol: "HONEY",
        decimals: 18,
        oneDecimalValue: new Decimal(10).pow(18), // decimals right above
        totalSupply: 11737742132405135320233771727n,
      },
    ],
    btcList: [
      {
        address: "0x2577D24a26f8FA19c1058a8b0106E2c7303454a4",
        name: "Wrapped Bitcoin",
        symbol: "WBTC",
        // it's different from BTC_DECIMAL so be careful
        decimals: 8,
        oneDecimalValue: new Decimal(10).pow(8), // decimals right above
        totalSupply: 100000000000000000000000n,
      },
    ],
  },
};
export function isETH(tokenAddress: string): boolean {
  return tokenAddress === ETH_ADDRESS;
}
export function isStableCoin(tokenAddress: string): boolean {
  const stableCoins = chains[CHAIN_ID].stableCoinList;

  return stableCoins.some((stableCoin) => stableCoin.address === tokenAddress);
}
export function isBTC(tokenAddress: string): boolean {
  const tokens = chains[CHAIN_ID].btcList;

  return tokens.some((token) => token.address === tokenAddress);
}
export function getStableCoin(
  tokenAddress: string,
): TokenDtoWithDecimal | null {
  const stableCoins = chains[CHAIN_ID].stableCoinList;

  const result = stableCoins.find(
    (stableCoin) => stableCoin.address === tokenAddress,
  );
  if (result == null) {
    return null;
  }
  return result;
}
export function getStableCoinOneDecimalValue(
  tokenAddress: string,
): Decimal | null {
  const stableCoin = getStableCoin(tokenAddress);
  if (!stableCoin) {
    return null;
  }
  return stableCoin.oneDecimalValue;
}
export function getBTC(tokenAddress: string): TokenDtoWithDecimal | null {
  const tokens = chains[CHAIN_ID].btcList;

  const result = tokens.find((token) => token.address === tokenAddress);
  if (result == null) {
    return null;
  }
  return result;
}
export function getBtcOneDecimalValue(tokenAddress: string): Decimal | null {
  const token = getBTC(tokenAddress);
  if (!token) {
    return null;
  }
  return token.oneDecimalValue;
}
