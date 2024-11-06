-- AddForeignKey
ALTER TABLE "copy_contract" ADD CONSTRAINT "copy_contract_contractAddress_transactionHash_blockNumber_fkey" FOREIGN KEY ("contractAddress", "transactionHash", "blockNumber") REFERENCES "contract"("address", "deploymentTransactionHash", "deploymentBlockNumber") ON DELETE RESTRICT ON UPDATE CASCADE;
