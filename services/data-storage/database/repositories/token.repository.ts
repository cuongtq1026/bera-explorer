import { type TokenDto, toTokenDto } from "@database/dto.ts";
import type { Hash } from "viem";

import prisma from "../prisma.ts";

export type TokenCreateInput = {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
};

export function getToken(address: Hash): Promise<TokenDto | null> {
  return prisma.token
    .findUnique({
      where: {
        address,
      },
    })
    .then((t) => {
      if (t == null) return null;
      return toTokenDto(t);
    });
}

export function createTokens(tokenCreateInputs: TokenCreateInput[]) {
  return prisma.token.createMany({
    data: tokenCreateInputs,
    skipDuplicates: true,
  });
}
