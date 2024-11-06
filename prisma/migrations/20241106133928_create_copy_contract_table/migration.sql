/*
  Warnings:

  - A unique constraint covering the columns `[address,deploymentTransactionHash,deploymentBlockNumber]` on the table `contract` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateTable
CREATE TABLE "copy_contract" (
    "contractAddress" TEXT NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "transactionHash" TEXT NOT NULL,
    "nftId" BIGINT NOT NULL,
    "creator" TEXT NOT NULL,
    "factory" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "copy_contract_pkey" PRIMARY KEY ("contractAddress")
);

-- CreateIndex
CREATE UNIQUE INDEX "contract_address_deploymentTransactionHash_deploymentBlockN_key" ON "contract"("address", "deploymentTransactionHash", "deploymentBlockNumber");

-- AddForeignKey
ALTER TABLE "copy_contract" ADD CONSTRAINT "copy_contract_transactionHash_fkey" FOREIGN KEY ("transactionHash") REFERENCES "transaction"("hash") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copy_contract" ADD CONSTRAINT "copy_contract_blockNumber_fkey" FOREIGN KEY ("blockNumber") REFERENCES "block"("number") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copy_contract" ADD CONSTRAINT "copy_contract_factory_transactionHash_blockNumber_fkey" FOREIGN KEY ("factory", "transactionHash", "blockNumber") REFERENCES "contract"("address", "deploymentTransactionHash", "deploymentBlockNumber") ON DELETE CASCADE ON UPDATE CASCADE;
