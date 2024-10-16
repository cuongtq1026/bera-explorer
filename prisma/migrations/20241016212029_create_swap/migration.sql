-- CreateTable
CREATE TABLE "swap" (
    "id" BIGSERIAL NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "transactionHash" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "dex" TEXT NOT NULL,
    "fromAmount" DECIMAL(78,0) NOT NULL,
    "toAmount" DECIMAL(78,0) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "swap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "erc20_price" (
    "tokenAddress" TEXT NOT NULL,
    "transactionHash" TEXT NOT NULL,
    "usd_price" DECIMAL(78,0) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE INDEX "swap_dex_idx" ON "swap"("dex");

-- CreateIndex
CREATE INDEX "swap_from_idx" ON "swap"("from");

-- CreateIndex
CREATE INDEX "swap_to_idx" ON "swap"("to");

-- CreateIndex
CREATE INDEX "erc20_price_transactionHash_idx" ON "erc20_price"("transactionHash");

-- CreateIndex
CREATE INDEX "erc20_price_tokenAddress_createdAt_idx" ON "erc20_price"("tokenAddress", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "erc20_price_tokenAddress_transactionHash_key" ON "erc20_price"("tokenAddress", "transactionHash");

-- AddForeignKey
ALTER TABLE "swap" ADD CONSTRAINT "swap_blockNumber_fkey" FOREIGN KEY ("blockNumber") REFERENCES "block"("number") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swap" ADD CONSTRAINT "swap_transactionHash_fkey" FOREIGN KEY ("transactionHash") REFERENCES "transaction"("hash") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "erc20_price" ADD CONSTRAINT "erc20_price_tokenAddress_fkey" FOREIGN KEY ("tokenAddress") REFERENCES "token"("address") ON DELETE RESTRICT ON UPDATE CASCADE;
