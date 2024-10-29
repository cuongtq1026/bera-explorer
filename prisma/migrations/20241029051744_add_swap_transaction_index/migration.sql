/*
  Warnings:

  - Added the required column `transactionIndex` to the `erc20_price` table without a default value. This is not possible if the table is not empty.
  - Added the required column `transactionIndex` to the `swap` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "erc20_price_blockNumber_idx";

-- AlterTable
ALTER TABLE "erc20_price" ADD COLUMN     "price_ref_id" BIGINT,
ADD COLUMN     "transactionIndex" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "swap" ADD COLUMN     "transactionIndex" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "erc20_price_blockNumber_transactionIndex_idx" ON "erc20_price"("blockNumber", "transactionIndex");

-- AddForeignKey
ALTER TABLE "erc20_price" ADD CONSTRAINT "erc20_price_price_ref_id_fkey" FOREIGN KEY ("price_ref_id") REFERENCES "erc20_price"("id") ON DELETE SET NULL ON UPDATE CASCADE;
