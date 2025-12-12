/*
  Warnings:

  - You are about to drop the `MarketMakerState` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "MarketMakerState" DROP CONSTRAINT "MarketMakerState_eventId_fkey";

-- DropTable
DROP TABLE "MarketMakerState";
