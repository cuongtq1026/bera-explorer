import type { TransactionDto } from "@database/dto.ts";

export interface ITransactionDecoder<DecodedFunctionName, DecodedInputType> {
  decodeTx(transaction: TransactionDto): {
    functionName: DecodedFunctionName;
    decoded: DecodedInputType;
  };
}
