-- CreateTable
CREATE TABLE "contract" (
    "address" TEXT NOT NULL,
    "name" TEXT,
    "deploymentTransactionHash" TEXT NOT NULL,
    "deploymentBlockNumber" BIGINT NOT NULL,

    CONSTRAINT "contract_pkey" PRIMARY KEY ("address")
);

-- AddForeignKey
ALTER TABLE "contract" ADD CONSTRAINT "contract_deploymentTransactionHash_fkey" FOREIGN KEY ("deploymentTransactionHash") REFERENCES "transaction"("hash") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract" ADD CONSTRAINT "contract_deploymentBlockNumber_fkey" FOREIGN KEY ("deploymentBlockNumber") REFERENCES "block"("number") ON DELETE RESTRICT ON UPDATE CASCADE;
