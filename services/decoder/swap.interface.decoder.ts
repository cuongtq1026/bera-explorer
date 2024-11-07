import type {
  LogDto,
  LogTopicDto,
  SwapChildrenDto,
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
  decodeSwaps(transaction: TransactionDto): SwapChildrenDto[];

  decodeETHToToken(args: DecodeArg<DecodedInputType>): SwapChildrenDto[];

  decodeTokenToETH(args: DecodeArg<DecodedInputType>): SwapChildrenDto[];

  decodeTokenToToken(args: DecodeArg<DecodedInputType>): SwapChildrenDto[];
}
