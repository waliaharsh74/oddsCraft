import express, { Router } from "express"
import { prisma, OrderSide, OrderStatus } from "@repo/db"
import Redis from "ioredis"

import { randomUUID } from "crypto"
import { TradeMsg, OrderBook, cancelSchema, orderSchema, balanceSchema, eventCreateSchema, eventUpdateSchema, EventSchema } from "@repo/common"

import { EventEmitter } from "events"
import { auth, requireAdmin } from "../middlewares"
import { AuthRequest } from "../interfaces"
import { logger } from "../lib/logger"
import authRouter from "./auth"
const router: Router = express.Router()

const books = new Map<string, OrderBook>()

const DEFAULT_DECIMALS = 2

const toMinorUnits = (value: number, decimal = DEFAULT_DECIMALS) => {
    const factor = Math.pow(10, decimal)
    return BigInt(Math.round(value * factor))
}

const fromMinorUnits = (value: string, decimal = DEFAULT_DECIMALS) =>
    Number(BigInt(value)) / Math.pow(10, decimal)

const addMinorUnits = (value: string, delta: bigint) => (BigInt(value) + delta).toString()

const calcStake = (price: number, qty: number, decimal = DEFAULT_DECIMALS) => toMinorUnits(price, decimal) * BigInt(qty)

function getBook(eventId: string) {
    if (!books.has(eventId)) books.set(eventId, new OrderBook())
    return books.get(eventId)!
}
function publishDepth(eventId: string) {
    const book = books.get(eventId)
    if (!book) return
    bus.emit("depth", {
        eventId,
        depth: { bids: book.depth("YES"), asks: book.depth("NO") },
    })
}


function publishTrades(eventId: string, trades: TradeMsg[]) {
    bus.emit("trade", { eventId, trades })
}

const bus = new EventEmitter()
const pub = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
    retryStrategy: a => Math.min(a * 200, 2_000),
})
bus.on("trade", (msg) => {
    pub.xadd("trades", "*", "data", JSON.stringify(msg))
})

function publish(channel: string, payload: unknown) {
    pub.publish(channel, JSON.stringify(payload))
}

bus.on("trade", (trades: TradeMsg[]) => publish("trade", trades))
bus.on("depth", (d: any) => publish("depth", d))

router.get("/hello", async (_req, res) => {
    res.status(200).json({ msg: "hello" })


})

router.use("/auth", authRouter)

router.use(auth)
router.get("/events", async (req, res) => {
    try {
        const parsed = EventSchema.safeParse(req.query)
        if (!parsed.success) {
            res.status(400).json({ error: parsed.error.flatten() })
            return
        }

        const events = await prisma.event.findMany({
            where: {
                ...parsed.data
            }
        })
        res.status(200).json(events)
    } catch (error) {
        res.status(500).json({
            error: "Internal Server Error!"
        })
    }

})

router.post("/orders", async (req: AuthRequest, res) => {
    try {
        const parsed = orderSchema.safeParse(req.body)
        if (!parsed.success) {
            res.status(400).json({ error: parsed.error.flatten() })
            return
        }

        const { eventId, side, price, qty } = parsed.data
        const userId = req.userId as string

        const eventRow = await prisma.event.findUnique({ where: { id: eventId } })
        if (!eventRow || eventRow.status !== "OPEN") {
            res.status(404).json({ error: "event_closed_or_missing" })
            return
        }

        const user = await prisma.user.findUnique({ where: { id: userId }, select: { balancePaise: true, decimal: true } })
        if (!user) {
            res.status(404).json({ error: "user_not_found" })
            return
        }

        const decimals = user.decimal ?? DEFAULT_DECIMALS
        const priceMinor = toMinorUnits(price, decimals)
        const stakeMinor = priceMinor * BigInt(qty)
        const balanceMinor = BigInt(user.balancePaise)

        if (balanceMinor < stakeMinor) {
            res.status(400).json({ error: "insufficient_balance" })
            return
        }

        const updatedBalance = addMinorUnits(user.balancePaise, -stakeMinor)

        const result = await prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id: userId },
                data: { balancePaise: updatedBalance },
            })

            const dbOrder = await tx.order.create({
                data: {
                    id: randomUUID(),
                    userId,
                    side: side as OrderSide,
                    pricePaise: priceMinor.toString(),
                    decimal: decimals,
                    qty,
                    openQty: qty,
                    status: "OPEN",
                    eventId,
                },
            })

            const trades = getBook(eventId).addOrder({
                id: dbOrder.id, userId, side, price, qty, createdAt: Date.now(),
            })
            for (const t of trades) {
                const tradePriceMinor = toMinorUnits(t.price, decimals)
                await tx.trade.create({
                    data: {
                        id: t.tradeId,
                        orderAggressorId: dbOrder.id,
                        makerOrderId: t.makerOrderId,
                        eventId,
                        side,
                        pricePaise: tradePriceMinor.toString(),
                        decimal: decimals,
                        qty: t.qty,
                        takerId: t.taker,
                        makerId: t.maker,
                        createdAt: new Date(t.ts),
                    },
                })

                const makerStakeMinor = calcStake(t.price, t.qty, decimals)
                const maker = await tx.user.findUnique({
                    where: { id: t.maker },
                    select: { balancePaise: true },
                })

                if (maker) {
                    await tx.user.update({
                        where: { id: t.maker },
                        data: { balancePaise: addMinorUnits(maker.balancePaise, makerStakeMinor) },
                    })
                }

                await tx.order.update({
                    where: { id: t.makerOrderId },
                    data: {
                        openQty: { decrement: t.qty },
                        status: t.remainingMakerQty ? "OPEN" : "FILLED",
                    },
                })
            }


            const filled = trades.reduce((s, t) => s + t.qty, 0)
            await tx.order.update({
                where: { id: dbOrder.id },
                data: {
                    openQty: qty - filled,
                    status: filled === qty ? "FILLED" : "OPEN",
                },
            })


            return { dbOrder, trades }
        })

        bus.emit("trade", { eventId, trades: result.trades })
        bus.emit("depth", {
            eventId, depth: {
                bids: getBook(eventId).depth("YES"),
                asks: getBook(eventId).depth("NO")
            }
        })

        res.status(200).json({ orderId: result.dbOrder.id, trades: result.trades })
    } catch (e: any) {
        if (e?.message === "FUNDS") {
            res.status(400).json({ error: "insufficient balance" })
            return
        }
        logger.error({ err: e }, "Order placement failed")
        res.status(500).json({ error: "server error" })
    }
})

router.get("/me/balance", async (req: AuthRequest, res) => {

    try {
        const userId = req.userId as string
        const balance = await prisma.user.findFirst({
            where: {
                id: userId
            },
            select: {
                balancePaise: true,
                decimal: true
            }
        })
        if (!balance) {
            res.status(404).json({ error: "Can't find the User" })
            return
        }
        const decimal = balance.decimal ?? DEFAULT_DECIMALS
        const amt = fromMinorUnits(balance.balancePaise, decimal)
        res.status(200).json({ msg: "Balance", balance: amt, balancePaise: balance.balancePaise, decimal })

    } catch (e: any) {
        logger.error({ err: e }, "Balance fetch failed")

        res.status(500).json({ error: "server error!" })
    }
})
router.get("/me/orders", async (req: AuthRequest, res) => {

    try {
        const userId = req.userId as string
        const status = (req.query.status as OrderStatus || "OPEN").toUpperCase()

        const where = { userId } as any
        if (status !== "ALL") where.status = status

        const orders = await prisma.order.findMany({
            where,

            orderBy: { createdAt: "desc" },
            include: {
                event: true
            }
        })
        const formatted = orders.map((o) => {
            const decimal = o.decimal ?? DEFAULT_DECIMALS
            return {
                ...o,
                price: fromMinorUnits(String(o.pricePaise), decimal),
            }
        })
        res.status(200).json(formatted)

    } catch (e: any) {
        logger.error({ err: e }, "Orders fetch failed")

        res.status(500).json({ error: "server error!" })
    }
})
router.get("/me/trades", async (req: AuthRequest, res) => {

    try {
        const userId = req.userId as string
        const trades = await prisma.trade.findMany({
            where: { OR: [{ makerId: userId }, { takerId: userId }] },
            orderBy: { createdAt: "desc" },
            take: 100,
            include: {
                event: true
            }
        })
        const formattedTrades = trades.map((t) => {
            const decimal = t.decimal ?? DEFAULT_DECIMALS
            return {
                ...t,
                price: fromMinorUnits(String(t.pricePaise), decimal),
            }
        })
        res.status(200).json(formattedTrades)

    } catch (e: any) {
        logger.error({ err: e }, "Trades fetch failed")

        res.status(500).json({ error: "server error!" })
    }
})
router.post("/wallet/topup", async (req: AuthRequest, res) => {

    try {
        const userId = req.userId as string
        const parsed = balanceSchema.safeParse(req.body)
        if (!parsed.success) {
            res.status(400).json({ error: parsed.error.flatten() })
            return
        }
        const { amt } = parsed.data
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { balancePaise: true, decimal: true }
        })
        if (!user) {
            res.status(404).json({ error: "Can't Increase the balance" })
            return
        }
        const decimal = user.decimal ?? DEFAULT_DECIMALS
        const increment = toMinorUnits(amt, decimal)
        const updatedBalance = addMinorUnits(user.balancePaise, increment)

        await prisma.user.update({
            where: { id: userId },
            data: { balancePaise: updatedBalance }
        })

        res.status(200).json({ msg: "Balance Increased", balance: fromMinorUnits(updatedBalance, decimal), balancePaise: updatedBalance, decimal })

    } catch (e: any) {
        logger.error({ err: e }, "Topup failed")

        res.status(500).json({ error: "server error!" })
    }
})
router.delete("/orders/:id", async (req: AuthRequest, res) => {
    try {
        const result = cancelSchema.safeParse({ params: req?.params })
        if (!result.success) {
            res.status(400).json({ error: result.error.flatten() })
            return
        }
        const id = result.data.params
        const userId = req.userId as string

        const row = await prisma.order.findUnique({ where: { id } })
        if (!row || row.userId !== userId || row.status !== "OPEN") {
            res.status(404).json({ error: "not_found" })
            return
        }
        const ok = getBook(row.eventId).cancel(id)
        if (!ok) {
            res.status(410).json({ error: "already_matched" })
            return
        }
        const refund = BigInt(row.pricePaise) * BigInt(row.openQty)
        await prisma.$transaction(async (tx) => {
            const user = await tx.user.findUnique({
                where: { id: row.userId },
                select: { balancePaise: true }
            })
            if (!user) throw new Error("user_not_found")

            await tx.user.update({
                where: { id: row.userId },
                data: { balancePaise: addMinorUnits(user.balancePaise, refund) },
            })
            await tx.order.update({
                where: { id },
                data: { status: "CANCELLED", openQty: 0 },
            })
        })

        publishDepth(row.eventId)
        res.status(200).json({ ok: true })
    } catch (error) {
        logger.error({ err: error }, "Order cancel failed")
        res.status(500).json({ error: "internal_error" })
    }

})


router.get("/depth", (req, res) => {
    const eventId = req.query.eventId as string | undefined
    if (!eventId) {
        res.status(400).json({ error: "eventId_required" })
        return
    }

    const book = books.get(eventId)
    if (!book) {
        res.status(200).json({ bids: [], asks: [] })
        return
    }

    res.status(200).json({ bids: book.depth("YES"), asks: book.depth("NO") })
})
router.get("/probability", (req, res) => {
    const eventId = req.query.eventId as string | undefined
    if (!eventId) {
        res.status(400).json({ error: "eventId_required" })
        return
    }
    const book = books.get(eventId)
    if (!book) {
        res.status(200).json({ probability: 0.5 })
        return
    }

    const bestBid = book.depth("YES")[0]?.price ?? 0
    const bestAsk = book.depth("NO")[0]?.price ?? 10
    res.status(200).json({ probability: (bestBid + bestAsk) / 20 })
})

router.use(requireAdmin)

router.post("/admin/event", async (req, res) => {
    const parsed = eventCreateSchema.safeParse(req.body)
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() })
        return
    }
    const ev = await prisma.event.create({ data: parsed.data })
    res.status(201).json(ev)
})

router.get("/admin/event", async (_req, res) => {
    const events = await prisma.event.findMany()
    res.status(200).json(events)
})

router.post("/admin/event/:id", async (req, res) => {
    const parsed = eventUpdateSchema.safeParse(req.body)
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() })
        return
    }
    const ev = await prisma.event.update({ where: { id: req.params.id }, data: { status: parsed.data.status } })
    res.status(200).json(ev)
})

export default router
