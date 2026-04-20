-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('STOCK', 'CRYPTO', 'REIT', 'FIAGRO');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('BRL', 'USD');

-- CreateEnum
CREATE TYPE "OperationType" AS ENUM ('BUY', 'SELL');

-- CreateTable
CREATE TABLE "users" (
    "telegram_id" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("telegram_id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "telegram_id" BIGINT NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "telegram_id" BIGINT NOT NULL,
    "amount" DECIMAL(18,8) NOT NULL,
    "category_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "type" "AssetType" NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'BRL',

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_operations" (
    "id" TEXT NOT NULL,
    "telegram_id" BIGINT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "quantity" DECIMAL(18,8) NOT NULL,
    "unit_price" DECIMAL(18,8) NOT NULL,
    "type" "OperationType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_operations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_telegram_id_key" ON "categories"("name", "telegram_id");

-- CreateIndex
CREATE UNIQUE INDEX "assets_ticker_key" ON "assets"("ticker");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_telegram_id_fkey" FOREIGN KEY ("telegram_id") REFERENCES "users"("telegram_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_telegram_id_fkey" FOREIGN KEY ("telegram_id") REFERENCES "users"("telegram_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_operations" ADD CONSTRAINT "asset_operations_telegram_id_fkey" FOREIGN KEY ("telegram_id") REFERENCES "users"("telegram_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_operations" ADD CONSTRAINT "asset_operations_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
