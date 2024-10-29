/*
  Warnings:

  - Added the required column `blockNumber` to the `erc20_price` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "erc20_price" ADD COLUMN     "blockNumber" BIGINT NOT NULL;

-- CreateIndex
CREATE INDEX "erc20_price_blockNumber_idx" ON "erc20_price"("blockNumber");

-- AddForeignKey
ALTER TABLE "erc20_price" ADD CONSTRAINT "erc20_price_blockNumber_fkey" FOREIGN KEY ("blockNumber") REFERENCES "block"("number") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "erc20_price" ADD CONSTRAINT "erc20_price_transactionHash_fkey" FOREIGN KEY ("transactionHash") REFERENCES "transaction"("hash") ON DELETE CASCADE ON UPDATE CASCADE;
