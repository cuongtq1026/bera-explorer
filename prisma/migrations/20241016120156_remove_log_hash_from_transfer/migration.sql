/*
  Warnings:

  - You are about to drop the column `logHash` on the `transfer` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "transfer" DROP CONSTRAINT "transfer_logHash_fkey";

-- DropIndex
DROP INDEX "transfer_logHash_key";

-- AlterTable
ALTER TABLE "transfer" DROP COLUMN "logHash";

-- AddForeignKey
ALTER TABLE "transfer" ADD CONSTRAINT "transfer_hash_fkey" FOREIGN KEY ("hash") REFERENCES "log"("logHash") ON DELETE RESTRICT ON UPDATE CASCADE;
