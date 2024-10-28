import type {
  LogDto,
  LogTopicDto,
  SwapDtoNoId,
  TransactionDto,
  TransactionReceiptDto,
} from "@database/dto.ts";
import type { Hash } from "viem";

import type { ITransactionDecoder } from "./interface.decoder.ts";

export type DecodeArg<DecodedInputType = any> = {
  transaction: TransactionDto;
  receipt: TransactionReceiptDto;
  logs: (LogDto & {
    topics: LogTopicDto[];
  })[];
  decoded: DecodedInputType;
  expectedRoutes: Hash[];
  dex: string;
};

export interface ISwapDecoder<DecodedInputType = any>
  extends ITransactionDecoder<DecodedInputType> {
  decodeSwaps(transaction: TransactionDto): SwapDtoNoId[];

  decodeETHToToken(args: DecodeArg<DecodedInputType>): SwapDtoNoId[];

  decodeTokenToETH(args: DecodeArg<DecodedInputType>): SwapDtoNoId[];

  decodeTokenToToken(args: DecodeArg<DecodedInputType>): SwapDtoNoId[];
}
