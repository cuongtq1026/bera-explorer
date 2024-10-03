-- CreateTable
CREATE TABLE "token" (
    "address" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "decimals" SMALLINT NOT NULL,
    "totalSupply" DECIMAL(78,0) NOT NULL,

    CONSTRAINT "token_pkey" PRIMARY KEY ("address")
);
