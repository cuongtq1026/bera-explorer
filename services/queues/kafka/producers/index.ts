import { IsNotEmpty } from "class-validator";

export class BlockMessagePayload {
  @IsNotEmpty()
  blockNumber: string;
}

export class LogMessagePayload {
  @IsNotEmpty()
  logHash: string;
}

export class SwapMessagePayload {
  @IsNotEmpty()
  swapId: string;
}

export class TransactionMessagePayload {
  @IsNotEmpty()
  hash: string;
}

export class TransferMessagePayload {
  @IsNotEmpty()
  transferHash: string;
}
