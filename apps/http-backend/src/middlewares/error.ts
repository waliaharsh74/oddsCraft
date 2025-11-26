import type { NextFunction, Request, Response } from "express"
import { logger } from "../lib/logger"

export class ApiError extends Error {
    statusCode: number
    code: string
    constructor(statusCode: number, code: string, message: string) {
        super(message)
        this.statusCode = statusCode
        this.code = code
    }
}

export const notFoundHandler = (_req: Request, _res: Response, next: NextFunction) => {
    next(new ApiError(404, "not_found", "Route not found"))
}

export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (res.headersSent) return

    const apiError = err instanceof ApiError
        ? err
        : new ApiError(500, "internal_error", "Something went wrong")

    logger.error({ err }, "Unhandled error")
    res.status(apiError.statusCode).json({
        success: false,
        error: {
            code: apiError.code,
            message: apiError.message
        }
    })
}
