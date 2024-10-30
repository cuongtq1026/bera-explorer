/*
  Warnings:

  - The primary key for the `erc20_price` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `erc20_price` table. All the data in the column will be lost.
  - You are about to drop the column `price_ref_id` on the `erc20_price` table. All the data in the column will be lost.
  - Added the required column `hash` to the `erc20_price` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "erc20_price" DROP CONSTRAINT "erc20_price_price_ref_id_fkey";

-- AlterTable
ALTER TABLE "erc20_price" DROP CONSTRAINT "erc20_price_pkey",
DROP COLUMN "id",
DROP COLUMN "price_ref_id",
ADD COLUMN     "hash" TEXT NOT NULL,
ADD COLUMN     "price_ref_hash" TEXT,
ADD CONSTRAINT "erc20_price_pkey" PRIMARY KEY ("hash");

-- AddForeignKey
ALTER TABLE "erc20_price" ADD CONSTRAINT "erc20_price_price_ref_hash_fkey" FOREIGN KEY ("price_ref_hash") REFERENCES "erc20_price"("hash") ON DELETE SET NULL ON UPDATE CASCADE;
