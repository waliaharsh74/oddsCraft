import jwt from "jsonwebtoken"
import dotenv from "dotenv"
import type { Response } from "express"
import { AUTH_TOKEN, REFRESH_TOKEN } from "@repo/common"
import { accessTokenCookieOptions, refreshTokenCookieOptions, ACCESS_JWT_SECRET, REFRESH_JWT_SECRET } from "../config/env"
import { string } from "zod/v4"

dotenv.config()

export interface TokenPayload {
    id: string
    role?: string
}

const tokenConfig = {
    [AUTH_TOKEN]: { secret: ACCESS_JWT_SECRET, expiresIn: "15m" },
    [REFRESH_TOKEN]: { secret: REFRESH_JWT_SECRET, expiresIn: "7d" }
} as const

export const createToken = (tokenType: typeof AUTH_TOKEN | typeof REFRESH_TOKEN, payload: TokenPayload) => {
    const { secret, expiresIn } = tokenConfig[tokenType]!
    return jwt.sign(payload, secret, { expiresIn })
}

export const verifyToken = (tokenType: typeof AUTH_TOKEN | typeof REFRESH_TOKEN, token: string): TokenPayload => {
    const { secret } = tokenConfig[tokenType]
    return jwt.verify(token, secret) as TokenPayload
}

export const setAuthCookies = (res: Response, payload: TokenPayload) => {
    const accessToken = createToken(AUTH_TOKEN, payload)
    const refreshToken = createToken(REFRESH_TOKEN, payload)

    res.cookie(AUTH_TOKEN, accessToken, accessTokenCookieOptions)
    res.cookie(REFRESH_TOKEN, refreshToken, refreshTokenCookieOptions)

    return { accessToken, refreshToken }
}

export const clearAuthCookies = (res: Response) => {
    res.clearCookie(AUTH_TOKEN, accessTokenCookieOptions)
    res.clearCookie(REFRESH_TOKEN, refreshTokenCookieOptions)
}
