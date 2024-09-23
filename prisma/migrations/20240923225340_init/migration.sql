-- CreateTable
CREATE TABLE "block" (
    "number" BIGINT NOT NULL,
    "hash" TEXT NOT NULL,
    "parentHash" TEXT NOT NULL,
    "nonce" TEXT,
    "sha3Uncles" TEXT NOT NULL,
    "logsBloom" TEXT,
    "transactionsRoot" TEXT NOT NULL,
    "stateRoot" TEXT NOT NULL,
    "receiptsRoot" TEXT NOT NULL,
    "miner" TEXT NOT NULL,
    "difficulty" BIGINT NOT NULL,
    "totalDifficulty" BIGINT NOT NULL,
    "extraData" TEXT,
    "size" BIGINT NOT NULL,
    "gasLimit" BIGINT NOT NULL,
    "gasUsed" BIGINT NOT NULL,
    "createdAt" BIGINT NOT NULL,

    CONSTRAINT "block_pkey" PRIMARY KEY ("number")
);

-- CreateTable
CREATE TABLE "transaction" (
    "hash" TEXT NOT NULL,
    "nonce" BIGINT NOT NULL,
    "blockHash" TEXT,
    "blockNumber" BIGINT,
    "transactionIndex" INTEGER,
    "from" TEXT NOT NULL,
    "to" TEXT,
    "input" TEXT NOT NULL,
    "value" BIGINT NOT NULL,
    "chainId" INTEGER,
    "gas" BIGINT NOT NULL,
    "gasPrice" BIGINT,

    CONSTRAINT "transaction_pkey" PRIMARY KEY ("hash")
);

-- CreateTable
CREATE TABLE "transaction_receipt" (
    "transactionHash" TEXT NOT NULL,
    "transactionIndex" INTEGER NOT NULL,
    "blockHash" TEXT NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT,
    "cumulativeGasUsed" BIGINT NOT NULL,
    "gasUsed" BIGINT NOT NULL,
    "contractAddress" TEXT,
    "logsBloom" TEXT NOT NULL,
    "status" BOOLEAN NOT NULL,
    "effectiveGasPrice" BIGINT NOT NULL,
    "type" TEXT NOT NULL,
    "root" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transaction_receipt_pkey" PRIMARY KEY ("transactionHash")
);

-- CreateTable
CREATE TABLE "log" (
    "logHash" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "transactionHash" TEXT NOT NULL,
    "transactionIndex" INTEGER NOT NULL,
    "index" INTEGER NOT NULL,
    "removed" BOOLEAN NOT NULL,

    CONSTRAINT "log_pkey" PRIMARY KEY ("logHash")
);

-- CreateTable
CREATE TABLE "log_topic" (
    "topicHash" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "logHash" TEXT NOT NULL,

    CONSTRAINT "log_topic_pkey" PRIMARY KEY ("topicHash")
);

-- CreateIndex
CREATE UNIQUE INDEX "block_number_key" ON "block"("number");

-- CreateIndex
CREATE UNIQUE INDEX "block_hash_key" ON "block"("hash");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_hash_key" ON "transaction"("hash");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_receipt_transactionHash_key" ON "transaction_receipt"("transactionHash");

-- AddForeignKey
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_blockNumber_fkey" FOREIGN KEY ("blockNumber") REFERENCES "block"("number") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_receipt" ADD CONSTRAINT "transaction_receipt_transactionHash_fkey" FOREIGN KEY ("transactionHash") REFERENCES "transaction"("hash") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log" ADD CONSTRAINT "log_transactionHash_fkey" FOREIGN KEY ("transactionHash") REFERENCES "transaction_receipt"("transactionHash") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_topic" ADD CONSTRAINT "log_topic_logHash_fkey" FOREIGN KEY ("logHash") REFERENCES "log"("logHash") ON DELETE CASCADE ON UPDATE CASCADE;
