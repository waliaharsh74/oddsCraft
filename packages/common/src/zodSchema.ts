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
});
export const cancelSchema = z.object({
    params:  z.string().uuid() ,
});
export const balanceSchema = z.object({
    amt: z.number().positive("Amount must be greater than zero")
});
