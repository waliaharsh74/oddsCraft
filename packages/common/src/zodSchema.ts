import { z } from "zod";
import { Side } from "./types";
export const signupSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6, "password >= 6"),
});

export const signinSchema = signupSchema; 

export const orderSchema = z.object({
    side: z.enum(["YES", "NO"]).transform((v) => v as Side),
    price: z.number().min(0).max(10),
    qty: z.number().int().positive(),
    eventId:z.string().uuid(),
    isExit: z.boolean().default(false)
});
export const cancelSchema = z.object({
    params:  z.string().uuid() ,
});
export const balanceSchema = z.object({
    amt: z.number().positive("Amount must be greater than zero")
});
export const eventCreateSchema = z.object({
    title: z.string().min(5).max(140),
    description: z.string().max(500).optional(),
    startsAt: z.coerce.date().optional().default(() => new Date()),
    endsAt: z.coerce.date().min(new Date()),
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
  
