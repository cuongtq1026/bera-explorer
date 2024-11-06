import type {
  LogDto,
  LogTopicDto,
  TransactionReceiptDto,
} from "@database/dto.ts";
import {
  type ContractCreateInput,
  createContracts,
} from "@database/repositories/contract.repository.ts";
import {
  createTokens,
  type TokenCreateInput,
} from "@database/repositories/token.repository.ts";
import { findTransactionReceipt } from "@database/repositories/transaction-receipt.repository.ts";
import { type Hash } from "viem";

import { CONTRACT_INITIATED_SIGNATURE } from "../config/constants.ts";
import { getERC20Tokens } from "../data-source";
import { NoGetResult } from "../exceptions/processor.exception.ts";
import { appLogger } from "../monitor/app.logger.ts";
import { AbstractProcessor } from "./abstract.processor.ts";

const serviceLogger = appLogger.namespace("TokenProcessor");

type ToInputArgType = Omit<TransactionReceiptDto, "logs"> & {
  logs: LogDto[];
};

/**
 * Token creation address can be found at three places:
 * 1. transaction.contract
 * 2. internal transaction's CREATE, CREATE2, CREATE3 opcodes
 * 3. receipt logs
 *
 * We only focus on transaction contract and logs
 */
export class ContractProcessor extends AbstractProcessor<
  Hash,
  ToInputArgType,
  Promise<{ tokens: TokenCreateInput[]; contracts: ContractCreateInput[] }>,
  void,
  Hash,
  TokenCreateInput[]
> {
  constructor() {
    super({
      logger: appLogger.namespace(ContractProcessor.name),
    });
  }

  async get(transactionHash: Hash): Promise<ToInputArgType> {
    const receipt = await findTransactionReceipt(transactionHash, {
      withLogs: true,
    });
    if (!receipt) {
      throw new NoGetResult(transactionHash);
    }
    const logs = receipt.logs;
    if (!logs) {
      throw new Error(`Transaction receipt logs not found`);
    }
    return {
      transactionHash: receipt.transactionHash as Hash,
      transactionIndex: receipt.transactionIndex,
      blockHash: receipt.blockHash,
      blockNumber: receipt.blockNumber,
      from: receipt.from,
      to: receipt.to,
      cumulativeGasUsed: receipt.cumulativeGasUsed,
      gasUsed: receipt.gasUsed,
      contractAddress: receipt.contractAddress,
      logsBloom: receipt.logsBloom,
      status: receipt.status,
      effectiveGasPrice: receipt.effectiveGasPrice,
      type: receipt.type,
      root: receipt.root,
      createdAt: receipt.createdAt,
      logs,
    };
  }

  async toInput(
    input: ToInputArgType,
  ): Promise<{ tokens: TokenCreateInput[]; contracts: ContractCreateInput[] }> {
    const addressSet = new Set<Hash>();
    const contracts: ContractCreateInput[] = [];

    // add receipt address contract
    if (input.contractAddress != null) {
      addressSet.add(input.contractAddress as Hash);

      contracts.push({
        address: input.contractAddress,
        deploymentTransactionHash: input.transactionHash,
        deploymentBlockNumber: input.blockNumber,
      });
    }

    // add contract creation logs (CONTRACT_INITIATED_SIGNATURE)
    input.logs
      .filter(
        (
          log,
        ): log is LogDto & {
          topics: LogTopicDto[];
        } => log.topics != null,
      )
      .filter((log) => log.topics[0]?.topic === CONTRACT_INITIATED_SIGNATURE)
      .forEach((log) => {
        addressSet.add(log.address as Hash);
      });

    const tokens = await getERC20Tokens(addressSet);
    tokens.forEach((token) => {
      contracts.push({
        address: token.address,
        deploymentTransactionHash: input.transactionHash,
        deploymentBlockNumber: input.blockNumber,
      });
    });

    return {
      tokens: tokens.map((token) => ({
        address: token.address,
        name: token.name,
        symbol: token.symbol,
        decimals: token.decimals,
        totalSupply: token.totalSupply.toString(),
      })),
      contracts: contracts.concat(
        tokens.map((token) => ({
          address: token.address,
          deploymentTransactionHash: input.transactionHash,
          deploymentBlockNumber: input.blockNumber,
        })),
      ),
    };
  }

  async deleteFromDb(): Promise<void> {
    return;
  }

  async createInDb(inputs: TokenCreateInput[]): Promise<void> {
    await createTokens(inputs);
  }

  async createContractsInDb(contracts: ContractCreateInput[]): Promise<void> {
    if (!contracts.length) {
      return;
    }
    await createContracts(contracts);
  }

  async process(transactionHash: Hash): Promise<void> {
    serviceLogger.info("processing: " + transactionHash);

    const obj = await this.get(transactionHash);

    const { tokens, contracts } = await this.toInput(obj);

    await this.createInDb(tokens);
    serviceLogger.info(`created ${transactionHash}`);
    await this.createContractsInDb(contracts);
    serviceLogger.info(`contract created ${transactionHash}`);
  }
}
