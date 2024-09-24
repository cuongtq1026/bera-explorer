/*
  Warnings:

  - Made the column `blockNumber` on table `transaction` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "transaction" DROP CONSTRAINT "transaction_blockNumber_fkey";

-- DropForeignKey
ALTER TABLE "transaction_receipt" DROP CONSTRAINT "transaction_receipt_transactionHash_fkey";

-- AlterTable
ALTER TABLE "transaction" ALTER COLUMN "blockNumber" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_blockNumber_fkey" FOREIGN KEY ("blockNumber") REFERENCES "block"("number") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_receipt" ADD CONSTRAINT "transaction_receipt_transactionHash_fkey" FOREIGN KEY ("transactionHash") REFERENCES "transaction"("hash") ON DELETE CASCADE ON UPDATE CASCADE;
