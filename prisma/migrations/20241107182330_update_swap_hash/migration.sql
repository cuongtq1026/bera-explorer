/*
  Warnings:

  - You are about to drop the column `swapId` on the `erc20_price` table. All the data in the column will be lost.
  - The primary key for the `swap` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `swap` table. All the data in the column will be lost.
  - Added the required column `swapHash` to the `erc20_price` table without a default value. This is not possible if the table is not empty.
  - Added the required column `hash` to the `swap` table without a default value. This is not possible if the table is not empty.
  - Added the required column `isRoot` to the `swap` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "erc20_price" DROP CONSTRAINT "erc20_price_swapId_fkey";

-- DropIndex
DROP INDEX "erc20_price_swapId_idx";

-- AlterTable
ALTER TABLE "erc20_price" DROP COLUMN "swapId",
ADD COLUMN     "swapHash" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "swap" DROP CONSTRAINT "swap_pkey",
DROP COLUMN "id",
ADD COLUMN     "hash" TEXT NOT NULL,
ADD COLUMN     "isRoot" BOOLEAN NOT NULL,
ADD COLUMN     "parentHash" TEXT,
ADD CONSTRAINT "swap_pkey" PRIMARY KEY ("hash");

-- AddForeignKey
ALTER TABLE "swap" ADD CONSTRAINT "swap_parentHash_fkey" FOREIGN KEY ("parentHash") REFERENCES "swap"("hash") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "erc20_price" ADD CONSTRAINT "erc20_price_swapHash_fkey" FOREIGN KEY ("swapHash") REFERENCES "swap"("hash") ON DELETE CASCADE ON UPDATE CASCADE;
