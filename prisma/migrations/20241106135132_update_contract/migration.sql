-- DropForeignKey
ALTER TABLE "copy_contract" DROP CONSTRAINT "copy_contract_factory_transactionHash_blockNumber_fkey";

-- AddForeignKey
ALTER TABLE "copy_contract" ADD CONSTRAINT "copy_contract_factory_transactionHash_blockNumber_fkey" FOREIGN KEY ("factory", "transactionHash", "blockNumber") REFERENCES "contract"("address", "deploymentTransactionHash", "deploymentBlockNumber") ON DELETE RESTRICT ON UPDATE CASCADE;
