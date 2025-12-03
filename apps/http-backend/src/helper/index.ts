import jwt from "jsonwebtoken"
import dotenv from "dotenv"
import type { Response } from "express"
import { ACCESS_TOKEN, REFRESH_TOKEN, USER_ID } from "@repo/common"
import { accessTokenCookieOptions, refreshTokenCookieOptions, ACCESS_JWT_SECRET, REFRESH_JWT_SECRET, userIdCookieOptions } from "../config/env"

dotenv.config()

export interface TokenPayload {
    id: string
    role?: string
}

const tokenConfig = {
    [ACCESS_TOKEN]: { secret: ACCESS_JWT_SECRET, expiresIn: "15m" },
    [REFRESH_TOKEN]: { secret: REFRESH_JWT_SECRET, expiresIn: "7d" }
} as const

export const createToken = (tokenType: typeof ACCESS_TOKEN | typeof REFRESH_TOKEN, payload: TokenPayload) => {
    const { secret, expiresIn } = tokenConfig[tokenType]!
    return jwt.sign(payload, secret, { expiresIn })
}

export const verifyToken = (tokenType: typeof ACCESS_TOKEN | typeof REFRESH_TOKEN, token: string): TokenPayload => {
    const { secret } = tokenConfig[tokenType]
    return jwt.verify(token, secret) as TokenPayload
}

export const setAuthCookies = (res: Response, payload: TokenPayload) => {
    const accessToken = createToken(ACCESS_TOKEN, payload)
    const refreshToken = createToken(REFRESH_TOKEN, payload)

    res.cookie(ACCESS_TOKEN, accessToken, accessTokenCookieOptions)
    res.cookie(REFRESH_TOKEN, refreshToken, refreshTokenCookieOptions)
    res.cookie(USER_ID, payload.id, userIdCookieOptions)

    return { accessToken, refreshToken }
}

export const clearAuthCookies = (res: Response) => {
    res.clearCookie(ACCESS_TOKEN, accessTokenCookieOptions)
    res.clearCookie(REFRESH_TOKEN, refreshTokenCookieOptions)
    res.clearCookie(USER_ID, userIdCookieOptions)
}
