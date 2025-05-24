import { z } from "zod"
import jwt from "jsonwebtoken";
import { NextFunction, Request, Response } from "express";
import { AuthRequest } from "../interfaces";
const JWT_SECRET = process.env.JWT_SECRET || "changeme";

export const auth = (req: AuthRequest, res: Response, next: NextFunction) => {
    const h = req.headers.authorization;
    if (!h?.startsWith("Bearer ")) {
        res.status(401).json({ error: "auth" });
        return
    }
    try {
        const { uid } = jwt.verify(h.slice(7), JWT_SECRET) as { uid: string };
        req.userId = uid;
        next();
    } catch { res.status(401).json({ error: "auth" }); return }
};

export function validate<T>(schema: z.Schema<T>) {
    return (req: Request, res: Response, next: NextFunction) => {
        const result = schema.safeParse({ body: req.body, params: req.params, query: req.query, headers: req.headers });
        if (!result.success) {
            res.status(400).json({ error: result.error.flatten() })
            return
        };

        // (req as any).validated = result.data;
        next();
    };
}
export const sign = (uid: string) => jwt.sign({ uid }, JWT_SECRET, { expiresIn: "7d" });