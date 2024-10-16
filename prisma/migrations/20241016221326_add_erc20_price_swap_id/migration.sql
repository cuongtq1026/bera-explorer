/*
  Warnings:

  - A unique constraint covering the columns `[swapId]` on the table `erc20_price` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `swapId` to the `erc20_price` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "erc20_price" ADD COLUMN     "swapId" BIGINT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "erc20_price_swapId_key" ON "erc20_price"("swapId");

-- AddForeignKey
ALTER TABLE "erc20_price" ADD CONSTRAINT "erc20_price_swapId_fkey" FOREIGN KEY ("swapId") REFERENCES "swap"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
