/*
  Warnings:

  - You are about to drop the column `price` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `Trade` table. All the data in the column will be lost.
  - You are about to drop the column `balance` on the `User` table. All the data in the column will be lost.
  - Added the required column `pricePaise` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `status` on the `Order` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `makerOrderId` to the `Trade` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pricePaise` to the `Trade` table without a default value. This is not possible if the table is not empty.
  - Made the column `orderAggressorId` on table `Trade` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('OPEN', 'FILLED', 'CANCELLED');

-- DropForeignKey
ALTER TABLE "Trade" DROP CONSTRAINT "Trade_orderAggressorId_fkey";

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "price",
ADD COLUMN     "pricePaise" INTEGER NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "OrderStatus" NOT NULL;

-- AlterTable
ALTER TABLE "Trade" DROP COLUMN "price",
ADD COLUMN     "makerOrderId" TEXT NOT NULL,
ADD COLUMN     "pricePaise" INTEGER NOT NULL,
ALTER COLUMN "orderAggressorId" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "balance",
ADD COLUMN     "balancePaise" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Order_status_side_idx" ON "Order"("status", "side");

-- CreateIndex
CREATE INDEX "Trade_makerId_idx" ON "Trade"("makerId");

-- CreateIndex
CREATE INDEX "Trade_takerId_idx" ON "Trade"("takerId");

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_orderAggressorId_fkey" FOREIGN KEY ("orderAggressorId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_makerOrderId_fkey" FOREIGN KEY ("makerOrderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
