/*
  Warnings:

  - You are about to drop the column `updatedAt` on the `transaction_receipt` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "transaction" ALTER COLUMN "value" SET DATA TYPE DECIMAL(78,0);

-- AlterTable
ALTER TABLE "transaction_receipt" DROP COLUMN "updatedAt";
