/*
  Warnings:

  - A unique constraint covering the columns `[contractAddress,target]` on the table `copy_contract` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `target` to the `copy_contract` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "copy_contract" ADD COLUMN     "target" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "copy_contract_target_idx" ON "copy_contract"("target");

-- CreateIndex
CREATE UNIQUE INDEX "copy_contract_contractAddress_target_key" ON "copy_contract"("contractAddress", "target");
