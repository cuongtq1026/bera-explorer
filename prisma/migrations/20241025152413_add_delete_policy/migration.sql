-- DropForeignKey
ALTER TABLE "contract" DROP CONSTRAINT "contract_deploymentBlockNumber_fkey";

-- DropForeignKey
ALTER TABLE "contract" DROP CONSTRAINT "contract_deploymentTransactionHash_fkey";

-- DropForeignKey
ALTER TABLE "erc20_price" DROP CONSTRAINT "erc20_price_swapId_fkey";

-- DropForeignKey
ALTER TABLE "swap" DROP CONSTRAINT "swap_blockNumber_fkey";

-- DropForeignKey
ALTER TABLE "swap" DROP CONSTRAINT "swap_transactionHash_fkey";

-- DropForeignKey
ALTER TABLE "transfer" DROP CONSTRAINT "transfer_hash_fkey";

-- AddForeignKey
ALTER TABLE "transfer" ADD CONSTRAINT "transfer_hash_fkey" FOREIGN KEY ("hash") REFERENCES "log"("logHash") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract" ADD CONSTRAINT "contract_deploymentTransactionHash_fkey" FOREIGN KEY ("deploymentTransactionHash") REFERENCES "transaction"("hash") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract" ADD CONSTRAINT "contract_deploymentBlockNumber_fkey" FOREIGN KEY ("deploymentBlockNumber") REFERENCES "block"("number") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swap" ADD CONSTRAINT "swap_blockNumber_fkey" FOREIGN KEY ("blockNumber") REFERENCES "block"("number") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swap" ADD CONSTRAINT "swap_transactionHash_fkey" FOREIGN KEY ("transactionHash") REFERENCES "transaction"("hash") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "erc20_price" ADD CONSTRAINT "erc20_price_swapId_fkey" FOREIGN KEY ("swapId") REFERENCES "swap"("id") ON DELETE CASCADE ON UPDATE CASCADE;
