import { IsIn, IsNumberString, IsOptional, Matches } from "class-validator";
import type { Hash } from "viem";

export class BlockPaginationQuery {
  @IsNumberString()
  @IsOptional()
  page?: string;
  @IsNumberString()
  @IsOptional()
  size?: string;
  @IsIn(["asc", "desc"])
  @IsOptional()
  order?: "asc" | "desc";
  @IsNumberString()
  @IsOptional()
  cursor?: string;
}

export class BlockPaginationDto {
  page?: number;
  size?: number;
  order?: "asc" | "desc";
  cursor?: bigint | number;
}

export class TransactionPaginationQuery {
  @IsNumberString()
  @IsOptional()
  page?: string;
  @IsNumberString()
  @IsOptional()
  size?: string;
  @IsIn(["asc", "desc"])
  @IsOptional()
  order?: "asc" | "desc";
  @Matches("^0x")
  @IsOptional()
  cursor?: string;
}

export class TransactionPaginationDto {
  page?: number;
  size?: number;
  order?: "asc" | "desc";
  cursor?: Hash;
}
