-- CreateEnum
CREATE TYPE "OutcomeStaus" AS ENUM ('YES', 'NO', 'DISPUTED');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('RESOLVED', 'INREVIEW');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "outcome" "OutcomeStaus";

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "decimal" INTEGER NOT NULL DEFAULT 2,
ALTER COLUMN "pricePaise" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "Trade" ADD COLUMN     "decimal" INTEGER NOT NULL DEFAULT 2,
ALTER COLUMN "pricePaise" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "decimal" INTEGER NOT NULL DEFAULT 2,
ALTER COLUMN "balancePaise" SET DEFAULT '100000',
ALTER COLUMN "balancePaise" SET DATA TYPE TEXT;

-- CreateTable
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'INREVIEW',

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Dispute_eventId_key" ON "Dispute"("eventId");

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
