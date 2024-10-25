import type { TransactionDto } from "@database/dto.ts";

export interface ITransactionDecoder<DecodedInputType> {
  decodeTx(transaction: TransactionDto): {
    functionName: string;
    decoded: DecodedInputType;
  };
}
