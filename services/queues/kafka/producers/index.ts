import { IsNotEmpty } from "class-validator";

export class BlockMessagePayload {
  @IsNotEmpty()
  blockNumber: string;
}

export class LogMessagePayload {
  @IsNotEmpty()
  logHash: string;
}

export class TransactionMessagePayload {
  @IsNotEmpty()
  hash: string;
}

export class TransferMessagePayload {
  @IsNotEmpty()
  transferHash: string;
}

export class SwapMessagePayload {
  @IsNotEmpty()
  swapHash: string;
}

export class PriceMessagePayload {
  @IsNotEmpty()
  priceId: string;
}

export class CopyTradeMessagePayload<success extends boolean = boolean> {
  transactionHash: success extends true ? string : null;
  @IsNotEmpty()
  swapHash: string;
  @IsNotEmpty()
  isSuccess: success;
  error: success extends false ? string : null;
}
