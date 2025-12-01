import express from "express"
import bcrypt from "bcryptjs"
import { prisma } from "@repo/db"
import { AUTH_TOKEN, REFRESH_TOKEN, signinSchema, signupSchema } from "@repo/common"
import { getAuthToken } from "../middlewares"
import { clearAuthCookies, setAuthCookies, verifyToken } from "../helper"
import { logger } from "../lib/logger"
import { AuthRequest } from "../interfaces"

const authRouter = express.Router()

authRouter.post("/signup", async (req, res) => {
    try {
        const result = signupSchema.safeParse(req.body)
        if (!result.success) {
            res.status(400).json({ error: result.error.flatten() })
            return
        }

        const { email, password } = result.data
        const exists = await prisma.user.findUnique({ where: { email } })
        if (exists) { res.status(400).json({ error: "email already registered" }); return }

        const user = await prisma.user.create({ data: { email, passwordHash: await bcrypt.hash(password, 10) } })
        const tokens = setAuthCookies(res, { id: user.id, role: user.role })
        res.status(201).json({
            id: user.id,
            msg: "User Registered Successfully!",
            user: { id: user.id, email: user.email, role: user.role },
            token: tokens.accessToken,
            refreshToken: tokens.refreshToken
        })
    } catch (error) {
        logger.error({ err: error }, "Signup failed")
        res.status(500).json({ error: "Internal Server Error" })
    }
})

authRouter.post("/signin", async (req, res) => {
    try {
        const result = signinSchema.safeParse(req.body)
        if (!result.success) {
            res.status(400).json({ error: result.error.flatten() })
            return
        }
        const { email, password } = result.data
        const user = await prisma.user.findUnique({ where: { email } })
        if (!user || !(await bcrypt.compare(password, user.passwordHash))) { res.status(401).json({ error: "Invalid Credentials" }); return }

        const tokens = setAuthCookies(res, { id: user.id, role: user.role })
        res.status(200).json({
            msg: "Welcome Back!",
            user: { id: user.id, email: user.email, role: user.role },
            token: tokens.accessToken,
            refreshToken: tokens.refreshToken
        })
    } catch (error) {
        logger.error({ err: error }, "Signin failed")
        res.status(500).json({ error: "Internal Server Error" })
    }
})

authRouter.post("/refresh", async (req, res) => {
    const refreshToken = req.cookies?.[REFRESH_TOKEN]
    if (!refreshToken) {
        res.status(401).json({ error: "refresh_token_missing" })
        return
    }
    try {
        const payload = verifyToken(REFRESH_TOKEN, refreshToken)
        const tokens = setAuthCookies(res, { id: payload.id, role: payload.role })
        res.status(200).json({
            msg: "Tokens refreshed",
            token: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            userId: payload.id,
        })
    } catch (error) {
        logger.warn({ err: error }, "Refresh token invalid")
        clearAuthCookies(res)
        res.status(401).json({ error: "refresh_token_invalid" })
    }
})

authRouter.get("/me", async (req: AuthRequest, res) => {
    const accessToken = getAuthToken(req)
    const refreshToken = req.cookies?.[REFRESH_TOKEN]

    if (!accessToken && !refreshToken) {
        res.status(401).json({ error: "not_authenticated" })
        return
    }

    try {
        let tokenRefreshed = false
        let userId: string | undefined

        if (accessToken) {
            try {
                const payload = verifyToken(AUTH_TOKEN, accessToken)
                userId = payload.id
            } catch (error) {
                logger.info({ err: error }, "Access token invalid, trying refresh")
            }
        }

        if (!userId && refreshToken) {
            try {
                const payload = verifyToken(REFRESH_TOKEN, refreshToken)
                userId = payload.id
                setAuthCookies(res, { id: payload.id, role: payload.role })
                tokenRefreshed = true
            } catch (error) {
                logger.warn({ err: error }, "Refresh token invalid at /me")
                clearAuthCookies(res)
                res.status(401).json({ error: "refresh_token_invalid" })
                return
            }
        }

        if (!userId) {
            res.status(401).json({ error: "not_authenticated" })
            return
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true, role: true }
        })

        if (!user) {
            clearAuthCookies(res)
            res.status(404).json({ error: "user_not_found" })
            return
        }

        res.status(200).json({ user, tokenRefreshed })
    } catch (error) {
        logger.error({ err: error }, "Failed to resolve /me")
        res.status(500).json({ error: "Internal Server Error" })
    }
})

authRouter.post("/logout", (_req, res) => {
    clearAuthCookies(res)
    res.status(200).json({ msg: "Logged out" })
})

export default authRouter
