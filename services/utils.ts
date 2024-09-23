import type { Hash } from "viem";

export function parseToBigInt(str: string): bigint | null {
  try {
    return BigInt(str);
  } catch (error) {
    logger.error("Invalid BigInt string:", error);
    return null;
  }
}

export function is0xHash(hash: string): hash is Hash {
  return hash.startsWith("0x");
}
