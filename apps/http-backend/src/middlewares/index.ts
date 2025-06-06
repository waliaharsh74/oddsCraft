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
        const {uid} = jwt.verify(h.slice(7), JWT_SECRET) as {uid:string};
        const parsed=JSON.parse(uid)
        req.userId = parsed.id;
        req.role = parsed.role;
        next();
    } catch { res.status(401).json({ error: "auth" }); return }
};
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        if (req.role !== 'ADMIN') { res.status(403).json({ error: 'forbidden' }); return }
        next();
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" }); return
    }


  }

export const sign = (uid: string) => jwt.sign({ uid }, JWT_SECRET, { expiresIn: "7d" });