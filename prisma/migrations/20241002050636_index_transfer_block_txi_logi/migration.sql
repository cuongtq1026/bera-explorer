/*
  Warnings:

  - Added the required column `transactionIndex` to the `transfer` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "transfer" ADD COLUMN     "transactionIndex" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "transfer_blockNumber_transactionIndex_logIndex_idx" ON "transfer"("blockNumber", "transactionIndex", "logIndex");
