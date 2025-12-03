import type { CorsOptions } from "cors"

const ACCESS_JWT_SECRET = process.env.ACCESS_JWT_SECRET || process.env.ACCES_JWT_SECRET || "changeme"
const REFRESH_JWT_SECRET = process.env.REFRESH_JWT_SECRET || ACCESS_JWT_SECRET

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000"
const isProd = process.env.NODE_ENV === "production"

const baseCookieOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" as const : "lax" as const,
    path: "/"
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
    // methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    // allowedHeaders: ["Content-Type", "Authorization"],
}

export {
    ACCESS_JWT_SECRET,
    REFRESH_JWT_SECRET,
    FRONTEND_URL,
    
}
