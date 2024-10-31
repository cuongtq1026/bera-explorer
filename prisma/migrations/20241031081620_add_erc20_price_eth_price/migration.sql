/*
  Warnings:

  - Added the required column `ethPrice` to the `erc20_price` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "erc20_price" ADD COLUMN     "ethPrice" DECIMAL(78,0) NOT NULL;
