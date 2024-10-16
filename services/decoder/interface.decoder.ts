import type { SwapDto, TransactionDto } from "@database/dto.ts";

export interface ITransactionDecoder<DecodedInputType> {
  decodeTx(transaction: TransactionDto): {
    functionName: string;
    decoded: DecodedInputType;
  };
}

export interface SwapDecoder<DecodedInputType = any>
  extends ITransactionDecoder<DecodedInputType> {
  decodeSwaps(transaction: TransactionDto): SwapDto[];
}
