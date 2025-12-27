
CREATE TYPE "OrderSide" AS ENUM ('YES', 'NO');


CREATE TYPE "OrderStatus" AS ENUM ('OPEN', 'FILLED', 'CANCELLED');


CREATE TYPE "OutcomeStaus" AS ENUM ('YES', 'NO', 'DISPUTED');


CREATE TYPE "Role" AS ENUM ('ADMIN', 'MEMBER');


CREATE TYPE "EventStatus" AS ENUM ('OPEN', 'CLOSED', 'SETTLED');


CREATE TYPE "DisputeStatus" AS ENUM ('RESOLVED', 'INREVIEW');


CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "passwordHash" TEXT NOT NULL,
    "balancePaise" TEXT NOT NULL DEFAULT '100000',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decimal" INTEGER NOT NULL DEFAULT 2,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);


CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "side" "OrderSide" NOT NULL,
    "pricePaise" TEXT NOT NULL,
    "decimal" INTEGER NOT NULL DEFAULT 2,
    "qty" INTEGER NOT NULL,
    "openQty" INTEGER NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventId" TEXT NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);


CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "orderAggressorId" TEXT NOT NULL,
    "makerOrderId" TEXT NOT NULL,
    "pricePaise" TEXT NOT NULL,
    "decimal" INTEGER NOT NULL DEFAULT 2,
    "side" "OrderSide" NOT NULL,
    "qty" INTEGER NOT NULL,
    "takerId" TEXT NOT NULL,
    "makerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventId" TEXT NOT NULL,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);


CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'OPEN',
    "outcome" "OutcomeStaus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);


CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'INREVIEW',

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);


CREATE TABLE "MarketMakerState" (
    "eventId" TEXT NOT NULL,
    "priceYesPaise" TEXT NOT NULL,
    "priceNoPaise" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL DEFAULT 2,
    "seedLiquidity" INTEGER NOT NULL,
    "sensitivity" DOUBLE PRECISION NOT NULL,
    "inventoryYes" INTEGER NOT NULL,
    "inventoryNo" INTEGER NOT NULL,
    "netYesExposure" INTEGER NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketMakerState_pkey" PRIMARY KEY ("eventId")
);


CREATE UNIQUE INDEX "User_email_key" ON "User"("email");


CREATE INDEX "Order_status_side_idx" ON "Order"("status", "side");


CREATE INDEX "Trade_makerId_idx" ON "Trade"("makerId");


CREATE INDEX "Trade_takerId_idx" ON "Trade"("takerId");


CREATE INDEX "Event_status_endsAt_idx" ON "Event"("status", "endsAt");


CREATE UNIQUE INDEX "Dispute_eventId_key" ON "Dispute"("eventId");


ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "Order" ADD CONSTRAINT "Order_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "Trade" ADD CONSTRAINT "Trade_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "Trade" ADD CONSTRAINT "Trade_orderAggressorId_fkey" FOREIGN KEY ("orderAggressorId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "Trade" ADD CONSTRAINT "Trade_makerOrderId_fkey" FOREIGN KEY ("makerOrderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "Trade" ADD CONSTRAINT "Trade_makerId_fkey" FOREIGN KEY ("makerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "Trade" ADD CONSTRAINT "Trade_takerId_fkey" FOREIGN KEY ("takerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "MarketMakerState" ADD CONSTRAINT "MarketMakerState_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
