-- DropForeignKey
ALTER TABLE "internal_transaction" DROP CONSTRAINT "internal_transaction_parentHash_fkey";

-- DropForeignKey
ALTER TABLE "internal_transaction" DROP CONSTRAINT "internal_transaction_transactionHash_fkey";

-- DropForeignKey
ALTER TABLE "log" DROP CONSTRAINT "log_blockNumber_fkey";

-- DropForeignKey
ALTER TABLE "transaction_receipt" DROP CONSTRAINT "transaction_receipt_blockNumber_fkey";

-- DropForeignKey
ALTER TABLE "transfer" DROP CONSTRAINT "transfer_blockNumber_fkey";

-- DropForeignKey
ALTER TABLE "transfer" DROP CONSTRAINT "transfer_transactionHash_fkey";

-- DropIndex
DROP INDEX "transfer_from_to_idx";

-- CreateTable
CREATE TABLE "balance" (
    "address" TEXT NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "amount" DECIMAL(78,0) NOT NULL,
    "transferHash" TEXT NOT NULL,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE INDEX "balance_address_idx" ON "balance"("address");

-- CreateIndex
CREATE INDEX "balance_tokenAddress_idx" ON "balance"("tokenAddress");

-- CreateIndex
CREATE UNIQUE INDEX "balance_address_tokenAddress_key" ON "balance"("address", "tokenAddress");

-- CreateIndex
CREATE INDEX "transfer_from_idx" ON "transfer"("from");

-- CreateIndex
CREATE INDEX "transfer_to_idx" ON "transfer"("to");

-- AddForeignKey
ALTER TABLE "transaction_receipt" ADD CONSTRAINT "transaction_receipt_blockNumber_fkey" FOREIGN KEY ("blockNumber") REFERENCES "block"("number") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log" ADD CONSTRAINT "log_blockNumber_fkey" FOREIGN KEY ("blockNumber") REFERENCES "block"("number") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_transaction" ADD CONSTRAINT "internal_transaction_transactionHash_fkey" FOREIGN KEY ("transactionHash") REFERENCES "transaction"("hash") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_transaction" ADD CONSTRAINT "internal_transaction_parentHash_fkey" FOREIGN KEY ("parentHash") REFERENCES "internal_transaction"("hash") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer" ADD CONSTRAINT "transfer_transactionHash_fkey" FOREIGN KEY ("transactionHash") REFERENCES "transaction"("hash") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer" ADD CONSTRAINT "transfer_blockNumber_fkey" FOREIGN KEY ("blockNumber") REFERENCES "block"("number") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "balance" ADD CONSTRAINT "balance_transferHash_fkey" FOREIGN KEY ("transferHash") REFERENCES "transfer"("hash") ON DELETE CASCADE ON UPDATE CASCADE;
