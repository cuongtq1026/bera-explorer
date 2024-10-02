import { IsNotEmpty } from "class-validator";

export const topics = {
  BALANCE: {
    name: "balance",
  },
};

export class BalanceMessagePayload {
  @IsNotEmpty()
  transferHash: string;
}
