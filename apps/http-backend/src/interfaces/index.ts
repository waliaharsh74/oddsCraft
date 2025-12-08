import { Request } from "express";

export type ValidatedInput = {
    body?: unknown
    params?: unknown
    query?: unknown
}

export interface AuthRequest extends Request {
    userId?: string
    role?: string
    validated?: ValidatedInput
}
