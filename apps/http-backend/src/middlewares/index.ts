import { ACCESS_TOKEN } from "@repo/common"
import { NextFunction, Response } from "express"
import { AuthRequest } from "../interfaces"
import { verifyToken } from "../helper"
import { logger } from "../lib/logger"

export const getAuthToken = (req: AuthRequest) => {
    const header = req.get("authorization")
    if (header?.toLowerCase().startsWith("bearer ")) {
        return header.slice("bearer ".length).trim()
    }
    return req.cookies?.[ACCESS_TOKEN]
}

export const auth = (req: AuthRequest, res: Response, next: NextFunction) => {
    const token = getAuthToken(req)

    if (!token) {
        res.status(401).json({ success: false, error: { code: "auth_token_missing", message: "Auth token not found" } })
        return
    }
    try {
        const payload = verifyToken(ACCESS_TOKEN, token)
        
        req.userId = payload.id
        req.role = payload.role
        next()
    } catch (error) {
        logger.warn({ err: error }, "Invalid auth token")
        res.status(401).json({ success: false, error: { code: "auth_token_invalid", message: "Invalid or expired auth token" } })
    }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        if (req.role !== "ADMIN") {
            res.status(403).json({ success: false, error: { code: "forbidden", message: "Admin access required" } })
            return
        }
        next()
    } catch (error) {
        logger.error({ err: error }, "Admin guard failed")
        res.status(500).json({ success: false, error: { code: "admin_guard_error", message: "Internal Server Error" } })
    }
}
