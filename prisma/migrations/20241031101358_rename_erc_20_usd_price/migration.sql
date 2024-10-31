/*
  Warnings:

  - You are about to drop the column `price_ref_hash` on the `erc20_price` table. All the data in the column will be lost.
  - You are about to drop the column `usd_price` on the `erc20_price` table. All the data in the column will be lost.
  - Added the required column `usdPrice` to the `erc20_price` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "erc20_price" DROP CONSTRAINT "erc20_price_ethPriceRefHash_fkey";

-- DropForeignKey
ALTER TABLE "erc20_price" DROP CONSTRAINT "erc20_price_price_ref_hash_fkey";

-- DropIndex
DROP INDEX "erc20_price_blockNumber_transactionIndex_idx";

-- AlterTable
ALTER TABLE "erc20_price" DROP COLUMN "price_ref_hash",
DROP COLUMN "usd_price",
ADD COLUMN     "usdPrice" DECIMAL(78,0) NOT NULL,
ADD COLUMN     "usdPriceRefHash" TEXT;

-- CreateIndex
CREATE INDEX "erc20_price_blockNumber_transactionIndex_hash_idx" ON "erc20_price"("blockNumber", "transactionIndex", "hash");

-- AddForeignKey
ALTER TABLE "erc20_price" ADD CONSTRAINT "erc20_price_usdPriceRefHash_fkey" FOREIGN KEY ("usdPriceRefHash") REFERENCES "erc20_price"("hash") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "erc20_price" ADD CONSTRAINT "erc20_price_ethPriceRefHash_fkey" FOREIGN KEY ("ethPriceRefHash") REFERENCES "erc20_price"("hash") ON DELETE CASCADE ON UPDATE CASCADE;
