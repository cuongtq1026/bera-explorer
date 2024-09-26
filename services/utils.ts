import type { Hash } from "viem";

export function parseToBigInt(str: string): bigint {
  return BigInt(str);
}

export function is0xHash(hash: string): hash is Hash {
  return hash.startsWith("0x");
}

export function getHostFromUrl(url: string) {
  const parsed = new URL(url);
  return parsed.host;
}
