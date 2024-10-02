-- CreateIndex
CREATE INDEX "transaction_receipt_blockNumber_transactionIndex_idx" ON "transaction_receipt"("blockNumber", "transactionIndex");
