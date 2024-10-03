import { toEventSelector } from "viem";

export const ERC20_TRANSFER_SIGNATURE = toEventSelector(
  "Transfer(address,address,uint256)",
);
export const CONTRACT_INITIATED_SIGNATURE = toEventSelector(
  "Initialized(uint64 version)",
);
