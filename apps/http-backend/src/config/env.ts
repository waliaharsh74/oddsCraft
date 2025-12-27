import type { CorsOptions } from "cors"

const ACCESS_JWT_SECRET = process.env.ACCESS_JWT_SECRET!
const REFRESH_JWT_SECRET = process.env.REFRESH_JWT_SECRET! || ACCESS_JWT_SECRET!

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000"
const isProd = process.env.NODE_ENV === "production"
const isHttpsFrontend = /^https:\/\//i.test(FRONTEND_URL)
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined

const parseBoolean = (value?: string) => {
    if (value === undefined) return
    const normalized = value.trim().toLowerCase()
    if (["true", "1", "yes"].includes(normalized)) return true
    if (["false", "0", "no"].includes(normalized)) return false
    return
}

const normalizeSameSite = (value?: string): "lax" | "strict" | "none" | undefined => {
    if (!value) return
    const normalized = value.trim().toLowerCase()
    if (normalized === "lax" || normalized === "strict" || normalized === "none") {
        return normalized
    }
    return
}

const cookieSecure = parseBoolean(process.env.COOKIE_SECURE) ?? (isProd && isHttpsFrontend)
const cookieSameSite =
    normalizeSameSite(process.env.COOKIE_SAMESITE) ??
    (isProd && cookieSecure ? "none" : "lax")

const baseCookieOptions = {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: cookieSameSite,
    path: "/",
    ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {})
}

export const accessTokenCookieOptions = {
    ...baseCookieOptions,
    maxAge: 15 * 60 * 1000, 
}

export const refreshTokenCookieOptions = {
    ...baseCookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000, 
}

export const userIdCookieOptions = {
    ...baseCookieOptions,
    httpOnly: false,
    maxAge: refreshTokenCookieOptions.maxAge,
}

export const corsOptions: CorsOptions = {
    origin: FRONTEND_URL,
    credentials: true,
    
    
}

export {
    ACCESS_JWT_SECRET,
    REFRESH_JWT_SECRET,
    FRONTEND_URL,
    
}
