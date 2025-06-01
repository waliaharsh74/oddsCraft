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


export const sign = (uid: string) => jwt.sign({ uid }, JWT_SECRET, { expiresIn: "7d" });