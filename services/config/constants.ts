import { toEventSelector } from "viem";

export const ERC20_TRANSFER_TOPIC = toEventSelector(
  "Transfer(address,address,uint256)",
);
