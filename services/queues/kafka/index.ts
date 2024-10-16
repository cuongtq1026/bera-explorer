import { IsNotEmpty, IsNumber } from "class-validator";

export const topics = {
  BALANCE: {
    name: "balance",
  },
  BLOCK: {
    name: "blocks",
  },
  TRANSACTION: {
    name: "transactions",
  },
  LOG: {
    name: "logs",
  },
  TRANSFER: {
    name: "transfers",
  },
};

export class BalanceMessagePayload {
  @IsNotEmpty()
  transferHash: string;
}

export class BlockMessagePayload {
  @IsNotEmpty()
  @IsNumber()
  blockNumber: number;
}

export class TransactionMessagePayload {
  @IsNotEmpty()
  hash: string;
}

export class TransferMessagePayload {
  @IsNotEmpty()
  transferHash: string;
}

export class LogMessagePayload {
  @IsNotEmpty()
  logHash: string;
}
