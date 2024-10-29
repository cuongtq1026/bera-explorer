import type Decimal from "decimal.js";
import Decimal from "decimal.js";
import type { Hash } from "viem";

export function parseToBigInt(str: string): bigint {
  return BigInt(str);
}

export function parseDecimalToBigInt(decimal: Decimal): bigint {
  return BigInt(decimal.toFixed(0));
}

export function is0xHash(hash: string): hash is Hash {
  return hash.startsWith("0x");
}

export function getHostFromUrl(url: string) {
  const parsed = new URL(url);
  return parsed.host;
}

export function shortenEthAddress(address: string | null): string {
  if (!address || !address.startsWith("0x")) {
    return "";
  }

  const start = address.slice(0, 6);
  const end = address.slice(-6);

  return `${start}...${end}`;
}

export function getSignature(input: string) {
  return input.slice(0, 10);
}
