import { PrismaClient, OrderSide } from "@prisma/client";

const prisma = new PrismaClient();

export {prisma,OrderSide}