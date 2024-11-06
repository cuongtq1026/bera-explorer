import {
  type LogDto,
  type LogTopicDto,
  type TransactionDto,
  type TransactionReceiptDto,
} from "@database/dto.ts";
import {
  type CopyContractCreateInput,
  createCopyContracts,
  deleteCopyContracts,
} from "@database/repositories/copy-contract.repository.ts";
import { findTransaction } from "@database/repositories/transaction.repository.ts";
import { decodeEventLog, erc20Abi, type Hash, type Hex } from "viem";

import { BeraCopyFactoryAbi } from "../config/abis";
import {
  COPY_CONTRACT_CREATED_SIGNATURE,
  CREATE_COPY_CONTRACT_SIGNATURE,
} from "../config/constants.ts";
import { NoGetResult } from "../exceptions/processor.exception.ts";
import { appLogger } from "../monitor/app.logger.ts";
import { getSignature } from "../utils.ts";
import { AbstractProcessor } from "./abstract.processor.ts";

type GetReturnType = Omit<TransactionDto, "receipt"> & {
  receipt: Omit<TransactionReceiptDto, "logs"> & {
    logs: (Omit<LogDto, "topics"> & {
      topics: LogTopicDto[];
    })[];
  };
};

export class CopyContractCreatedProcessor extends AbstractProcessor<
  Hash,
  GetReturnType,
  CopyContractCreateInput[] | null
> {
  constructor() {
    super({
      logger: appLogger.namespace(CopyContractCreatedProcessor.name),
    });
  }

  async get(id: Hash): Promise<GetReturnType> {
    const transaction = await findTransaction(id, {
      withReceipt: true,
    });
    if (transaction == null || transaction.receipt == null) {
      throw new NoGetResult(id);
    }
    return transaction as GetReturnType;
  }

  toInput(transactionDto: GetReturnType): CopyContractCreateInput[] | null {
    const isSuccessTx = transactionDto.receipt.status;
    const isCreateContractSignature =
      getSignature(transactionDto.input) === CREATE_COPY_CONTRACT_SIGNATURE;
    if (!isSuccessTx || !isCreateContractSignature) {
      return null;
    }
    const factoryAddress = transactionDto.to;
    if (factoryAddress == null) {
      throw Error("No factory found.");
    }

    // get contracts from logs
    return (
      transactionDto.receipt.logs
        // filter out events
        .filter((log) => {
          const signature = log.topics[0]?.topic;
          return signature === COPY_CONTRACT_CREATED_SIGNATURE;
        })
        // get result from topics
        .map<CopyContractCreateInput>((log) => {
          const signature = log.topics[0]?.topic as Hash;
          const logTopics = log.topics.slice(1).map((t) => t.topic as Hex);
          const decodedTopics = decodeEventLog({
            abi: BeraCopyFactoryAbi,
            eventName: "CopyTradeCreated",
            data: log.data as Hash,
            topics: [signature, ...logTopics],
          });

          return {
            contractAddress: decodedTopics.args.createdAddress,
            createdAt: transactionDto.receipt.createdAt,
            creator: decodedTopics.args.creator,
            blockNumber: transactionDto.blockNumber,
            transactionHash: transactionDto.hash,
            factory: factoryAddress,
            nftId: decodedTopics.args.tokenId,

            contract: {
              deploymentTransactionHash: transactionDto.hash,
              deploymentBlockNumber: transactionDto.blockNumber,
              address: decodedTopics.args.createdAddress,
              name: "BeraCopy",
            },
          };
        })
    );
  }

  async deleteFromDb(txHash: Hash): Promise<void> {
    await deleteCopyContracts(txHash);
  }

  async createInDb(inputs: CopyContractCreateInput[]): Promise<void> {
    await createCopyContracts(inputs);
  }

  async process(id: Hash): Promise<void> {
    this.serviceLogger.info("processing: " + id);

    const obj = await this.get(id);

    const inputs = this.toInput(obj);

    if (!inputs) {
      return;
    }

    await this.deleteFromDb(id);
    this.serviceLogger.info(`deleted txHash ${id}`);
    await this.createInDb(inputs);
    this.serviceLogger.info(`created txHash ${id}`);
  }
}
