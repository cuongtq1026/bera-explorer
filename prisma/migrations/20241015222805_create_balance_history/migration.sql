-- CreateTable
CREATE TABLE "balance_history" (
    "hash" TEXT NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "transactionIndex" INTEGER NOT NULL,
    "index" INTEGER NOT NULL,
    "logIndex" INTEGER NOT NULL,
    "transactionHash" TEXT NOT NULL,
    "transferHash" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "amount" DECIMAL(78,0) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "balance_history_pkey" PRIMARY KEY ("hash")
);

-- CreateIndex
CREATE INDEX "balance_history_address_idx" ON "balance_history"("address");

-- CreateIndex
CREATE INDEX "balance_history_address_tokenAddress_idx" ON "balance_history"("address", "tokenAddress");

-- CreateIndex
CREATE INDEX "balance_history_blockNumber_transactionIndex_logIndex_idx" ON "balance_history"("blockNumber", "transactionIndex", "logIndex");

-- CreateIndex
CREATE INDEX "balance_history_transferHash_idx" ON "balance_history"("transferHash");

-- CreateIndex
CREATE INDEX "balance_history_createdAt_idx" ON "balance_history"("createdAt");

-- CreateIndex
CREATE INDEX "balance_history_amount_createdAt_idx" ON "balance_history"("amount", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "balance_history_transactionHash_transferHash_address_key" ON "balance_history"("transactionHash", "transferHash", "address");

-- AddForeignKey
ALTER TABLE "balance_history" ADD CONSTRAINT "balance_history_transferHash_fkey" FOREIGN KEY ("transferHash") REFERENCES "transfer"("hash") ON DELETE CASCADE ON UPDATE CASCADE;
