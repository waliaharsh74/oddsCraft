import "dotenv/config";
import { PrismaClient, OrderSide, OrderStatus, Role, EventStatus } from "./generated/prisma/client";

import { PrismaPg } from "@prisma/adapter-pg";

declare global {
  var __prisma: PrismaClient | undefined;
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is missing. Set it in your service .env file (see README.md).");
}

const prisma =
  globalThis.__prisma ??
  (() => {
    const adapter = new PrismaPg({
      connectionString,
    });

    const client = new PrismaClient({ adapter });

    globalThis.__prisma = client;
    return client;
  })();

export { prisma, OrderSide, OrderStatus, Role, EventStatus };
