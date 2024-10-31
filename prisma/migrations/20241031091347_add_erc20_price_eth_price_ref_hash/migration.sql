-- AlterTable
ALTER TABLE "erc20_price" ADD COLUMN     "ethPriceRefHash" TEXT;

-- AddForeignKey
ALTER TABLE "erc20_price" ADD CONSTRAINT "erc20_price_ethPriceRefHash_fkey" FOREIGN KEY ("ethPriceRefHash") REFERENCES "erc20_price"("hash") ON DELETE SET NULL ON UPDATE CASCADE;
