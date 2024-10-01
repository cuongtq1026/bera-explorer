-- CreateTable
CREATE TABLE "transfer" (
    "hash" TEXT NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "transactionHash" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "amount" DECIMAL(78,0) NOT NULL,
    "logIndex" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transfer_pkey" PRIMARY KEY ("hash")
);

-- CreateIndex
CREATE INDEX "transfer_from_to_idx" ON "transfer"("from", "to");

-- CreateIndex
CREATE INDEX "transfer_tokenAddress_idx" ON "transfer"("tokenAddress");

-- CreateIndex
CREATE INDEX "transfer_timestamp_idx" ON "transfer"("timestamp");

-- AddForeignKey
ALTER TABLE "transaction_receipt" ADD CONSTRAINT "transaction_receipt_blockNumber_fkey" FOREIGN KEY ("blockNumber") REFERENCES "block"("number") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log" ADD CONSTRAINT "log_blockNumber_fkey" FOREIGN KEY ("blockNumber") REFERENCES "block"("number") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer" ADD CONSTRAINT "transfer_transactionHash_fkey" FOREIGN KEY ("transactionHash") REFERENCES "transaction"("hash") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer" ADD CONSTRAINT "transfer_blockNumber_fkey" FOREIGN KEY ("blockNumber") REFERENCES "block"("number") ON DELETE RESTRICT ON UPDATE CASCADE;
