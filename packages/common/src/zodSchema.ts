import { z } from "zod";
import { Side } from "./types";
export const signupSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6, "password >= 6"),
});

export const eventIdQuerySchema = z.object({
    eventId: z.string().uuid(),
})

export const ordersQuerySchema = z.object({
    status: z.enum(["OPEN", "FILLED", "CANCELLED", "ALL"]).optional(),
})

export const signinSchema = signupSchema; 

export const orderSchema = z.object({
    side: z.enum(["YES", "NO"]).transform((v) => v as Side),
    price: z.number().min(0.1).max(9.9),
    qty: z.number().int().positive(),
    eventId:z.string().uuid(),
    isExit: z.boolean().default(false),
    orderType: z.enum(["LIMIT", "MARKET"]).default("LIMIT"),
});
export const liquidateSchema=z.object({
    eventId: z.string().uuid(),
    qty:z.number().int().positive(),
   
}).refine((payload) => payload.qty !== undefined ,{
    message: "qty_required",
    path: ["qty"],
})
export const cancelSchema = z.object({
    id:  z.string().uuid() ,
});
export const balanceSchema = z.object({
    amt: z.number().positive("Amount must be greater than zero").max(10000,"maximum toptup of 10k is allowed")
});
export const eventCreateSchema = z.object({
    title: z.string().min(5).max(140),
    description: z.string().max(500).optional(),
    startsAt: z.coerce.date().optional().default(() => new Date()),
    endsAt: z.coerce.date().min(new Date()),
    liquidity:z.number().optional()
});

export const eventUpdateSchema = z.object({
    title: z.string().min(5).max(140).optional(),
    description: z.string().max(500).optional(),
    endsAt: z.coerce.date().optional(),
    status: z.enum(['OPEN', 'CLOSED', 'SETTLED']).optional(),
});
export const EventStatusEnum = z.enum(['OPEN', 'CLOSED', 'SETTLED']);
export const EventSchema = z.object({
    id:z.string().uuid().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    status: EventStatusEnum.optional(),
});
  
