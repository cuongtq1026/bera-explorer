-- AlterTable
CREATE SEQUENCE erc20_price_id_seq;
ALTER TABLE "erc20_price" ALTER COLUMN "id" SET DEFAULT nextval('erc20_price_id_seq');
ALTER SEQUENCE erc20_price_id_seq OWNED BY "erc20_price"."id";
