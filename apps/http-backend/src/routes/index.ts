import express, { Router } from "express"
import { prisma, OrderSide, OrderStatus } from "@repo/db"

import { randomUUID } from "crypto"
import { z } from "zod"
import { TradeMsg, OrderBook, cancelSchema, orderSchema, balanceSchema, eventCreateSchema, eventUpdateSchema, EventSchema, liquidateSchema, REDIS_CHANNELS, redisKeys, RedisChannel } from "@repo/common"

import { EventEmitter } from "events"
import { auth, requireAdmin, zodHandler } from "../middlewares"
import { AuthRequest } from "../interfaces"
import { logger } from "../lib/logger"
import { marketMaker } from "../lib/marketMakerClient"
import { redis } from "../lib/redis"
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

const eventIdQuerySchema = z.object({
    eventId: z.string().uuid(),
})

const ordersQuerySchema = z.object({
    status: z.enum(["OPEN", "FILLED", "CANCELLED", "ALL"]).optional(),
})

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
bus.on("trade", (msg) => {
    redis.xadd(redisKeys.tradesStream, "*", "data", JSON.stringify(msg))
})

function publish(channel: RedisChannel, payload: unknown) {
    const serialized = JSON.stringify(payload)
    redis.publish(channel, serialized)
    persistLastPayload(channel, serialized, payload)
}

function persistLastPayload(channel: RedisChannel, serializedPayload: string, payload: unknown) {
    if (!payload || typeof payload !== "object") return
    const eventId = (payload as { eventId?: string }).eventId
    if (!eventId) return

    let key: string | null = null
    if (channel === REDIS_CHANNELS.depth) key = redisKeys.lastDepth(eventId)
    if (channel === REDIS_CHANNELS.pricing) key = redisKeys.lastPricing(eventId)
    if (!key) return

    redis.set(key, serializedPayload).catch((err) => logger.error({ err, channel, eventId }, "Failed to persist Redis payload"))
}

bus.on("trade", (payload) => publish(REDIS_CHANNELS.trade, payload))
bus.on("depth", (d: any) => publish(REDIS_CHANNELS.depth, d))
const publishPricing = async (eventId: string) => {
    const state = await marketMaker.getState(eventId)
    if (!state) return
    const decimals = state.decimals ?? DEFAULT_DECIMALS
    publish(REDIS_CHANNELS.pricing, {
        eventId,
        state,
        priceYes: fromMinorUnits(state.priceYesPaise, decimals),
        priceNo: fromMinorUnits(state.priceNoPaise, decimals),
    })
}

router.get("/hello", async (_req, res) => {
    res.status(200).json({ msg: "hello" })


})

router.use("/auth", authRouter)

router.use(auth)
router.get("/events", zodHandler({ query: EventSchema }), async (req: AuthRequest, res) => {
    try {
        const filters = (req.validated?.query as z.infer<typeof EventSchema>) ?? {}
        const events = await prisma.event.findMany({
            where: {
                ...filters
            }
        })
        res.status(200).json(events)
    } catch (error) {
        res.status(500).json({
            error: "Internal Server Error!"
        })
    }

})

router.post("/orders", zodHandler({ body: orderSchema }), async (req: AuthRequest, res) => {
    try {
        const { eventId, side, price, qty, isExit } = req.validated?.body as z.infer<typeof orderSchema>
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
        try {
            await marketMaker.seedMarket(eventId, { decimals })
        } catch (err) {
            logger.warn({ err, eventId }, "Failed to seed market maker state")
        }
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
                id: dbOrder.id, userId, side, price, qty, createdAt: Date.now(), isExit,
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

        if (result.trades.length) {
            void marketMaker.applyTrades(eventId, result.trades.map((t) => ({ side: t.side, qty: t.qty, decimals })))
                .then(() => publishPricing(eventId))
                .catch((err: unknown) => logger.error({ err, eventId }, "Market maker update failed"))
        }

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

router.post("/liquidate", zodHandler({ body: liquidateSchema }), async (req: AuthRequest, res) => {
    try {
        const { eventId, side, qty } = req.validated?.body as z.infer<typeof liquidateSchema>
        const eventRow = await prisma.event.findUnique({ where: { id: eventId } })
        if (!eventRow || eventRow.status !== "OPEN") {
            res.status(404).json({ error: "event_closed_or_missing" })
            return
        }

        const quote = await marketMaker.getQuote(eventId)
        const decimals = quote.state.decimals ?? DEFAULT_DECIMALS
        const exitPrice = side === "YES" ? quote.priceYes : quote.priceNo
        const platformSide = side === "YES" ? "NO" : "YES"

        const updatedState = await marketMaker.applyTrades(eventId, [{ side: platformSide, qty, decimals }])
        void publishPricing(eventId)

        res.status(200).json({
            ok: true,
            exitPrice,
            valuePaise: toMinorUnits(exitPrice, decimals).toString(),
            state: updatedState,
            note: "Exit fills against platform inventory; settlement/position accounting should be handled by the caller.",
        })
    } catch (error) {
        logger.error({ err: error }, "Liquidation failed")
        res.status(500).json({ error: "internal_error" })
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
router.get("/me/orders", zodHandler({ query: ordersQuerySchema }), async (req: AuthRequest, res) => {

    try {
        const userId = req.userId as string
        const { status } = (req.validated?.query as z.infer<typeof ordersQuerySchema> | undefined) ?? {}
        const normalizedStatus = (status ?? "OPEN") as string

        const where: { userId: string; status?: OrderStatus } = { userId }
        if (normalizedStatus !== "ALL") where.status = normalizedStatus as OrderStatus

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
router.post("/wallet/topup", zodHandler({ body: balanceSchema }), async (req: AuthRequest, res) => {

    try {
        const userId = req.userId as string
        const { amt } = req.validated?.body as z.infer<typeof balanceSchema>
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
router.delete("/orders/:id", zodHandler({ params: cancelSchema }), async (req: AuthRequest, res) => {
    try {
        const { id } = req.validated?.params as z.infer<typeof cancelSchema>
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


router.get("/depth", zodHandler({ query: eventIdQuerySchema }), (req: AuthRequest, res) => {
    const { eventId } = req.validated?.query as z.infer<typeof eventIdQuerySchema>
    const book = books.get(eventId)
    if (!book) {
        res.status(200).json({ bids: [], asks: [] })
        return
    }

    res.status(200).json({ bids: book.depth("YES"), asks: book.depth("NO") })
})
router.get("/probability", zodHandler({ query: eventIdQuerySchema }), async (req: AuthRequest, res) => {
    try {
        const { eventId } = req.validated?.query as z.infer<typeof eventIdQuerySchema>
        const mmState = await marketMaker.getState(eventId)
        if (mmState) {
            const decimals = mmState.decimals ?? DEFAULT_DECIMALS
            const priceYes = fromMinorUnits(mmState.priceYesPaise, decimals)
            const priceNo = fromMinorUnits(mmState.priceNoPaise, decimals)
            res.status(200).json({ probability: priceYes / 10, priceYes, priceNo, source: "market_maker" })
            return
        }

        const book = books.get(eventId)
        if (!book) {
            res.status(200).json({ probability: 0.5 })
            return
        }

        const bestBid = book.depth("YES")[0]?.price ?? 0
        const bestAsk = book.depth("NO")[0]?.price ?? 10
        res.status(200).json({ probability: (bestBid + bestAsk) / 20, source: "orderbook" })
    } catch (error) {
        logger.error({ err: error }, "Probability fetch failed")
        res.status(500).json({ error: "internal_error" })
    }
})

router.use(requireAdmin)

router.post("/admin/event", zodHandler({ body: eventCreateSchema }), async (req: AuthRequest, res) => {
    const payload = req.validated?.body as z.infer<typeof eventCreateSchema>
    const ev = await prisma.event.create({ data: payload })
    try {
        await marketMaker.seedMarket(ev.id)
        await publishPricing(ev.id)
    } catch (err) {
        logger.warn({ err, eventId: ev.id }, "Failed to seed market maker for new event")
    }
    res.status(201).json(ev)
})

router.get("/admin/event", async (_req, res) => {
    const events = await prisma.event.findMany()
    res.status(200).json(events)
})

const updateEvent = async (req: AuthRequest, res: express.Response) => {
    try {
        const { id } = req.validated?.params as z.infer<typeof cancelSchema>
        const payload = req.validated?.body as z.infer<typeof eventUpdateSchema>
        const ev = await prisma.event.update({ where: { id }, data: { ...payload } })
        res.status(200).json(ev)
    } catch (error: any) {
        if (error?.code === "P2025") {
            res.status(404).json({ error: "not_found" })
            return
        }
        logger.error({ err: error }, "Event update failed")
        res.status(500).json({ error: "internal_error" })
    }
}

router.post("/admin/event/:id", zodHandler({ body: eventUpdateSchema, params: cancelSchema }), updateEvent)
router.put("/admin/event/:id", zodHandler({ body: eventUpdateSchema, params: cancelSchema }), updateEvent)

router.delete("/admin/event/:id", zodHandler({ params: cancelSchema }), async (req: AuthRequest, res) => {
    const { id } = req.validated?.params as z.infer<typeof cancelSchema>
    try {
        await prisma.event.delete({ where: { id } })
    } catch (error: any) {
        if (error?.code === "P2025") {
            res.status(404).json({ error: "not_found" })
            return
        }
        if (error?.code === "P2003") {
            res.status(409).json({ error: "event_in_use" })
            return
        }
        logger.error({ err: error, eventId: id }, "Event delete failed")
        res.status(500).json({ error: "internal_error" })
        return
    }

    books.delete(id)
    try {
        await Promise.all([
            redis.del(redisKeys.lastDepth(id)),
            redis.del(redisKeys.lastPricing(id)),
            redis.del(redisKeys.marketMakerState(id)),
            marketMaker.reset(id),
        ])
    } catch (err) {
        logger.warn({ err, eventId: id }, "Event cleanup failed")
    }

    res.status(200).json({ ok: true })
})

export default router
