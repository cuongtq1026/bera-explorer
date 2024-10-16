/*
  Warnings:

  - A unique constraint covering the columns `[logHash]` on the table `transfer` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `logHash` to the `transfer` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "transfer" ADD COLUMN     "logHash" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "transfer_logHash_key" ON "transfer"("logHash");

-- AddForeignKey
ALTER TABLE "transfer" ADD CONSTRAINT "transfer_logHash_fkey" FOREIGN KEY ("logHash") REFERENCES "log"("logHash") ON DELETE RESTRICT ON UPDATE CASCADE;
