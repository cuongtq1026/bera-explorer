/*
  Warnings:

  - Added the required column `id` to the `erc20_price` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "erc20_price_swapId_key";

-- DropIndex
DROP INDEX "erc20_price_tokenAddress_transactionHash_key";

-- AlterTable
ALTER TABLE "erc20_price" ADD COLUMN     "id" BIGINT NOT NULL,
ADD CONSTRAINT "erc20_price_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE INDEX "erc20_price_swapId_idx" ON "erc20_price"("swapId");
