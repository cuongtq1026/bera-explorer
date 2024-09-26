import "express-async-errors";

import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import express from "express";

import { errorHandler, logErrors } from "./services/api/error.ts";
import {
  BadRequestException,
  ItemNotFoundException,
} from "./services/api/error/client.exception.ts";
import { toBlockOutput } from "./services/api/output/block.output.ts";
import { toTransactionOutput } from "./services/api/output/transaction.output.ts";
import {
  BlockPaginationDto,
  BlockPaginationQuery,
  TransactionPaginationDto,
  TransactionPaginationQuery,
} from "./services/api/pagination.ts";
import {
  findBlock,
  findBlocks,
} from "./services/data-storage/database/repositories/block.repository.ts";
import {
  findTransaction,
  findTransactions,
} from "./services/data-storage/database/repositories/transaction.repository.ts";
import { is0xHash, parseToBigInt } from "./services/utils.ts";

const app = express();
const port = 8080;

app.get("/block/:blockNumber", async (req, res) => {
  const params = req.params;
  const blockNumber = parseToBigInt(params.blockNumber);
  if (blockNumber === null) {
    throw new Error(`Invalid block number: ${blockNumber}`);
  }

  const { withTransactions: withTransactionsRaw } = req.query;
  const withTransactions = Boolean(withTransactionsRaw === "true");

  const block = await findBlock(blockNumber, withTransactions);
  if (!block) {
    throw new ItemNotFoundException("Block not found");
  }

  const blockOutput = toBlockOutput(block);
  res.send(blockOutput);
});

app.get("/blocks", async (req, res) => {
  const params = req.query;

  const { page, size, cursor, order } = params;
  const paginationQuery = plainToInstance(BlockPaginationQuery, {
    page,
    size,
    cursor,
    order,
  });

  const errors = await validate(paginationQuery);
  if (errors.length > 0) {
    throw new BadRequestException(`Invalid pagination params: ${errors}`);
  }
  const pagination: BlockPaginationDto = {
    page: paginationQuery.page != null ? +paginationQuery.page : undefined,
    size: paginationQuery.size != null ? +paginationQuery.size : undefined,
    order: paginationQuery.order,
    cursor: paginationQuery.cursor ? +paginationQuery.cursor : undefined,
  };

  const blocks = await findBlocks(pagination);
  const blockOutputs = blocks.map(toBlockOutput);
  res.send(blockOutputs);
});

app.get("/transaction/:hash", async (req, res) => {
  const params = req.params;
  const transactionHash = params.hash;
  if (transactionHash == null || !is0xHash(transactionHash)) {
    throw new BadRequestException(
      `Invalid transaction hash: ${transactionHash}`,
    );
  }

  const { withReceipt } = req.query;
  const transaction = await findTransaction(
    transactionHash,
    withReceipt === "true",
  );
  if (!transaction) {
    throw new ItemNotFoundException("Transaction not found");
  }

  const transactionOutput = toTransactionOutput(transaction);
  res.send(transactionOutput);
});

app.get("/block/:blockNumber/transactions", async (req, res) => {
  const blockNumber = parseToBigInt(req.params.blockNumber);
  if (blockNumber === null) {
    throw new Error(`Invalid block number: ${blockNumber}`);
  }

  const block = await findBlock(blockNumber);
  if (!block) {
    throw new ItemNotFoundException("Block not found");
  }

  const { page, size, cursor, order } = req.query;
  const paginationQuery = plainToInstance(TransactionPaginationQuery, {
    page,
    size,
    cursor,
    order,
  });

  const errors = await validate(paginationQuery);
  if (errors.length > 0) {
    throw new BadRequestException(`Invalid pagination params: ${errors}`);
  }
  const pagination: TransactionPaginationDto = {
    page: paginationQuery.page != null ? +paginationQuery.page : undefined,
    size: paginationQuery.size != null ? +paginationQuery.size : undefined,
    order: paginationQuery.order,
    cursor:
      paginationQuery.cursor && is0xHash(paginationQuery.cursor)
        ? paginationQuery.cursor
        : undefined,
  };

  const transactions = await findTransactions(blockNumber, pagination);
  const transactionOutputs = transactions.map(toTransactionOutput);
  res.send(transactionOutputs);
});

// After middlewares
app.use(logErrors);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Listening on port http://localhost:${port}`);
});
