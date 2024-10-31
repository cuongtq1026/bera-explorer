/*
  Warnings:

  - Added the required column `btcPrice` to the `erc20_price` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "erc20_price" ADD COLUMN     "btcPrice" DECIMAL(78,0) NOT NULL,
ADD COLUMN     "btcPriceRefHash" TEXT;

-- AddForeignKey
ALTER TABLE "erc20_price" ADD CONSTRAINT "erc20_price_btcPriceRefHash_fkey" FOREIGN KEY ("btcPriceRefHash") REFERENCES "erc20_price"("hash") ON DELETE CASCADE ON UPDATE CASCADE;
