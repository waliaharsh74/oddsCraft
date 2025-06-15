import { PrismaClient, OrderSide,OrderStatus,Role,EventStatus } from "@prisma/client";

const prisma = new PrismaClient();

export { prisma, OrderSide, OrderStatus, Role, EventStatus }