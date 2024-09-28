-- CreateTable
CREATE TABLE "internal_transaction" (
    "hash" TEXT NOT NULL,
    "parentHash" TEXT,
    "transactionHash" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "input" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" DECIMAL(78,0) NOT NULL,
    "gas" DECIMAL(78,0) NOT NULL,
    "gasUsed" DECIMAL(78,0) NOT NULL,

    CONSTRAINT "internal_transaction_pkey" PRIMARY KEY ("hash")
);

-- CreateIndex
CREATE UNIQUE INDEX "internal_transaction_hash_key" ON "internal_transaction"("hash");

-- AddForeignKey
ALTER TABLE "internal_transaction" ADD CONSTRAINT "internal_transaction_transactionHash_fkey" FOREIGN KEY ("transactionHash") REFERENCES "transaction"("hash") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_transaction" ADD CONSTRAINT "internal_transaction_parentHash_fkey" FOREIGN KEY ("parentHash") REFERENCES "internal_transaction"("hash") ON DELETE SET NULL ON UPDATE CASCADE;
