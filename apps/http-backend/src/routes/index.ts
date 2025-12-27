import express, { Router } from "express"
import { prisma, OrderSide, OrderStatus } from "@repo/db"

import { randomUUID } from "crypto"
import { z } from "zod"
import { cancelSchema, orderSchema, balanceSchema, eventCreateSchema, eventUpdateSchema, EventSchema, liquidateSchema, redisKeys, OrderBook, OrderInMem, eventIdQuerySchema, ordersQuerySchema, assertValid, roundToTick } from "@repo/common"

import type { AuthRequest } from "@repo/common"
import { auth, requireAdmin, zodHandler } from "../middlewares"
import { logger } from "../lib/logger"

import { redis } from "../lib/redis"
import authRouter from "./auth"
import { addMinorUnits, books, calcStake, DEFAULT_DECIMALS, fromMinorUnits, getBook, LIQUIDATION_PRICE, publishDepth, publishTrades, resolvePlatformUser, toMinorUnits } from "../util"

const router: Router = express.Router()

type SettlementOutcome = "YES" | "NO" | "VOID"
type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

const normalizeOutcome = (outcome?: string | null): SettlementOutcome | null => {
    if (!outcome) return null
    if (outcome === "YES" || outcome === "NO" || outcome === "VOID") return outcome
    return null
}

const addBalanceDelta = (deltas: Map<string, bigint>, userId: string, delta: bigint) => {
    if (delta === 0n) return
    deltas.set(userId, (deltas.get(userId) ?? 0n) + delta)
}

const applyBalanceDeltas = async (tx: TxClient, deltas: Map<string, bigint>) => {
    if (deltas.size === 0) return
    const userIds = [...deltas.keys()]
    const users = await tx.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, balancePaise: true },
    })
    const userMap = new Map(users.map((u) => [u.id, u.balancePaise]))
    for (const [userId, delta] of deltas) {
        const balance = userMap.get(userId)
        if (!balance) throw new Error("user_not_found")
        await tx.user.update({
            where: { id: userId },
            data: { balancePaise: addMinorUnits(balance, delta) },
        })
    }
}

const settleEventPositions = async (
    tx: TxClient,
    eventId: string,
    outcome: SettlementOutcome
) => {
    const openOrders = await tx.order.findMany({
        where: { eventId, status: OrderStatus.OPEN },
    })
    const trades = await tx.trade.findMany({
        where: { eventId },
        include: {
            aggressorOrder: { select: { decimal: true } },
            makerOrder: { select: { decimal: true } },
        },
    })

    const deltas = new Map<string, bigint>()

    for (const order of openOrders) {
        const refund = BigInt(order.pricePaise) * BigInt(order.openQty)
        addBalanceDelta(deltas, order.userId, refund)
    }

    await tx.order.updateMany({
        where: { eventId, status: OrderStatus.OPEN },
        data: { status: OrderStatus.CANCELLED, openQty: 0 },
    })

    if (outcome === "VOID") {
        for (const trade of trades) {
            const takerDecimals = trade.aggressorOrder.decimal ?? DEFAULT_DECIMALS
            const makerDecimals = trade.makerOrder.decimal ?? DEFAULT_DECIMALS
            const tradePrice = fromMinorUnits(trade.pricePaise, trade.decimal ?? DEFAULT_DECIMALS)
            const takerRefund = calcStake(tradePrice, trade.qty, takerDecimals)
            const makerRefund = calcStake(10 - tradePrice, trade.qty, makerDecimals)
            addBalanceDelta(deltas, trade.takerId, takerRefund)
            addBalanceDelta(deltas, trade.makerId, makerRefund)
        }
    }

    await applyBalanceDeltas(tx, deltas)
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
        const { eventId, side, price, qty, isExit, orderType } = req.validated?.body as z.infer<typeof orderSchema>
        const userId = req.userId as string
        const normalizedOrderType = orderType ?? "LIMIT"
        const isMarket = normalizedOrderType === "MARKET"
        const hasPrice = typeof price === "number" && Number.isFinite(price)

        if (!Number.isFinite(qty) || qty <= 0) {
            res.status(400).json({ error: "bad_qty" })
            return
        }
        if (!isMarket && !hasPrice) {
            res.status(400).json({ error: "bad_price" })
            return
        }

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
        if (!isMarket) assertValid(price!, qty)
        const normalizedPrice = isMarket ? 0 : roundToTick(price!)

        const priceMinor = isMarket ? 0n : toMinorUnits(normalizedPrice, decimals)
        const stakeMinor = isMarket ? 0n : priceMinor * BigInt(qty)
        const balanceMinor = BigInt(user.balancePaise)

        if (!isMarket && balanceMinor < stakeMinor) {
            res.status(400).json({ error: "insufficient_balance" })
            return
        }

        const result = await prisma.$transaction(async (tx) => {
            if (!isMarket && stakeMinor > 0n) {
                const updatedBalance = addMinorUnits(user.balancePaise, -stakeMinor)
                await tx.user.update({
                    where: { id: userId },
                    data: { balancePaise: updatedBalance },
                })
            }

            const dbOrder = await tx.order.create({
                data: {
                    id: randomUUID(),
                    userId,
                    side: side as OrderSide,
                    pricePaise: isMarket ? "0" : priceMinor.toString(),
                    decimal: decimals,
                    qty,
                    openQty: qty,
                    status: "OPEN",
                    eventId,
                },
            })

            const trades = getBook(eventId).addOrder(
                {
                    id: dbOrder.id,
                    userId,
                    side,
                    price: normalizedPrice,
                    qty,
                    createdAt: Date.now(),
                    isExit,
                    orderType: normalizedOrderType,
                },
                isMarket
                    ? {
                        maxCost: balanceMinor,
                        costForFill: (fillPrice, fillQty) =>
                            calcStake(fillPrice, fillQty, decimals),
                        skipSelfTrade: true,
                    }
                    : { skipSelfTrade: true }
            )
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

                await tx.order.update({
                    where: { id: t.makerOrderId },
                    data: {
                        openQty: { decrement: t.qty },
                        status: t.remainingMakerQty ? "OPEN" : "FILLED",
                    },
                })
            }


            const filled = trades.reduce((s, t) => s + t.qty, 0)
            const remaining = qty - filled
            const filledCostMinor = trades.reduce(
                (s, t) => s + calcStake(t.price, t.qty, decimals),
                BigInt(0)
            )
            if (isMarket) {
                if (filledCostMinor > balanceMinor) throw new Error("insufficient_balance")
                if (filledCostMinor > 0n) {
                    const taker = await tx.user.findUnique({
                        where: { id: userId },
                        select: { balancePaise: true },
                    })
                    if (!taker) throw new Error("user_not_found")
                    await tx.user.update({
                        where: { id: userId },
                        data: { balancePaise: addMinorUnits(taker.balancePaise, -filledCostMinor) },
                    })
                }
            } else {
                const reservedRemainingMinor = priceMinor * BigInt(remaining)
                const finalDebit = filledCostMinor + reservedRemainingMinor
                const refund = stakeMinor - finalDebit
                if (refund > 0n) {
                    const taker = await tx.user.findUnique({
                        where: { id: userId },
                        select: { balancePaise: true },
                    })
                    if (!taker) throw new Error("user_not_found")
                    await tx.user.update({
                        where: { id: userId },
                        data: { balancePaise: addMinorUnits(taker.balancePaise, refund) },
                    })
                }
            }
            await tx.order.update({
                where: { id: dbOrder.id },
                data: {
                    openQty: isMarket ? 0 : remaining,
                    status: isMarket
                        ? filled === qty
                            ? "FILLED"
                            : "CANCELLED"
                        : filled === qty
                            ? "FILLED"
                            : "OPEN",
                },
            })


            return { dbOrder, trades }
        })

        publishTrades(eventId, result.trades)
        publishDepth(eventId)



        res.status(200).json({ orderId: result.dbOrder.id, trades: result.trades })
    } catch (e: any) {
        if (e?.message === "bad_qty" || e?.message === "bad_price" || e?.message === "bad_tick") {
            res.status(400).json({ error: e.message })
            return
        }
        if (e?.message === "insufficient_balance") {
            res.status(400).json({ error: "insufficient_balance" })
            return
        }
        logger.error({ err: e }, "Order placement failed")
        res.status(500).json({ error: "server error" })
    }
})

router.post("/liquidate", zodHandler({ body: liquidateSchema }), async (req: AuthRequest, res) => {
    try {
        const { eventId, qty: qtyInput } = req.validated?.body as z.infer<typeof liquidateSchema>
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
        const priceMinor = toMinorUnits(LIQUIDATION_PRICE, decimals)
        const derivedQty = qtyInput ?? 0

        if (!derivedQty || derivedQty <= 0) {
            res.status(400).json({ error: "invalid_liquidation_size" })
            return
        }

        const qty = derivedQty
        const totalCostMinor = priceMinor * BigInt(qty) * BigInt(2)
        const balanceMinor = BigInt(user.balancePaise)
        if (balanceMinor < totalCostMinor) {
            res.status(400).json({ error: "insufficient_balance" })
            return
        }

        const createdAt = Date.now()

        const created = await prisma.$transaction(async (tx) => {
            const updatedBalance = addMinorUnits(user.balancePaise, -totalCostMinor)
            await tx.user.update({
                where: { id: userId },
                data: { balancePaise: updatedBalance },
            })

            const yesOrder = await tx.order.create({
                data: {
                    id: randomUUID(),
                    userId,
                    side: "YES",
                    pricePaise: priceMinor.toString(),
                    decimal: decimals,
                    qty,
                    openQty: qty,
                    status: OrderStatus.OPEN,
                    eventId,
                },
            })

            const noOrder = await tx.order.create({
                data: {
                    id: randomUUID(),
                    userId,
                    side: "NO",
                    pricePaise: priceMinor.toString(),
                    decimal: decimals,
                    qty,
                    openQty: qty,
                    status: OrderStatus.OPEN,
                    eventId,
                },
            })

            return { yesOrder, noOrder }
        })

        const book = getBook(eventId)
        book.seedOrders([
            { id: created.yesOrder.id, userId, side: "YES", price: LIQUIDATION_PRICE, qty, createdAt, isExit: false },
            { id: created.noOrder.id, userId, side: "NO", price: LIQUIDATION_PRICE, qty, createdAt, isExit: false },
        ])
        publishDepth(eventId)

        res.status(200).json({
            ok: true,
            price: LIQUIDATION_PRICE,
            qty,
            totalCostPaise: totalCostMinor.toString(),
            yesOrderId: created.yesOrder.id,
            noOrderId: created.noOrder.id,
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

router.post("/events/:id/claim", zodHandler({ params: cancelSchema }), async (req: AuthRequest, res) => {
    try {
        const { id: eventId } = req.validated?.params as z.infer<typeof cancelSchema>
        const userId = req.userId as string

        const event = await prisma.event.findUnique({
            where: { id: eventId },
            include: { dispute: true },
        })
        if (!event) {
            res.status(404).json({ error: "event_not_found" })
            return
        }
        if (event.status !== "SETTLED") {
            res.status(400).json({ error: "event_not_settled" })
            return
        }
        if (event.dispute && event.dispute.status !== "RESOLVED") {
            res.status(409).json({ error: "dispute_open" })
            return
        }
        const outcome = normalizeOutcome(event.outcome)
        if (!outcome || outcome === "VOID") {
            res.status(400).json({ error: "no_claimable_outcome" })
            return
        }

        const claimId = randomUUID()
        const claimedAt = new Date()

        const eligibleTrades = await prisma.trade.findMany({
            where: {
                eventId,
                claimId: null,
                OR: outcome === "YES"
                    ? [
                        { side: "YES", takerId: userId },
                        { side: "NO", makerId: userId },
                    ]
                    : [
                        { side: "NO", takerId: userId },
                        { side: "YES", makerId: userId },
                    ],
            },
            select: { id: true },
        })

        if (!eligibleTrades.length) {
            res.status(200).json({ claimedTrades: 0, payoutPaise: "0", feePaise: "0", netPaise: "0" })
            return
        }

        const claimResult = await prisma.$transaction(async (tx) => {
            const ids = eligibleTrades.map((t) => t.id)
            await tx.trade.updateMany({
                where: { id: { in: ids }, claimId: null },
                data: { claimId, claimedAt, claimedBy: userId },
            })

            const claimedTrades = await tx.trade.findMany({
                where: { claimId },
                include: {
                    aggressorOrder: { select: { decimal: true } },
                    makerOrder: { select: { decimal: true } },
                },
            })

            if (!claimedTrades.length) {
                return { payout: 0n, fee: 0n, net: 0n, claimedTrades: 0 }
            }

            let payout = 0n
            for (const trade of claimedTrades) {
                const takerDecimals = trade.aggressorOrder.decimal ?? DEFAULT_DECIMALS
                const makerDecimals = trade.makerOrder.decimal ?? DEFAULT_DECIMALS
                const winnerDecimals = outcome === "YES"
                    ? trade.side === "YES"
                        ? takerDecimals
                        : makerDecimals
                    : trade.side === "NO"
                        ? takerDecimals
                        : makerDecimals
                payout += calcStake(10, trade.qty, winnerDecimals)
            }

            const fee = payout / 100n
            const net = payout - fee
            const deltas = new Map<string, bigint>()
            if (net > 0n) addBalanceDelta(deltas, userId, net)
            if (fee > 0n) {
                const platform = await resolvePlatformUser(tx)
                addBalanceDelta(deltas, platform.id, fee)
            }
            await applyBalanceDeltas(tx, deltas)

            return { payout, fee, net, claimedTrades: claimedTrades.length }
        })

        res.status(200).json({
            claimedTrades: claimResult.claimedTrades,
            payoutPaise: claimResult.payout.toString(),
            feePaise: claimResult.fee.toString(),
            netPaise: claimResult.net.toString(),
        })
    } catch (error) {
        logger.error({ err: error }, "Claim payout failed")
        res.status(500).json({ error: "internal_error" })
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
        if (row.openQty !== row.qty) {
            res.status(410).json({ error: "already_matched" })
            return
        }
        const book = books.get(row.eventId)
        const cancelledInBook = book ? book.cancel(id) : false
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
        res.status(200).json({ ok: true, refundedPaise: refund.toString(), cancelledInBook })
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

export async function hydrateBooksFromDb() {
    const openOrders = await prisma.order.findMany({
        where: { status: OrderStatus.OPEN },
        orderBy: { createdAt: "asc" },
    })

    const ordersByEvent = new Map<string, OrderInMem[]>();

    for (const order of openOrders) {
        if (order.openQty <= 0) continue

        const decimals = order.decimal ?? DEFAULT_DECIMALS
        const price = fromMinorUnits(order.pricePaise, decimals)

        const seeded: OrderInMem = {
            id: order.id,
            userId: order.userId,
            side: order.side,
            price,
            qty: order.openQty,
            createdAt: order.createdAt.getTime(),
            isExit: false,
        }

        const bucket = ordersByEvent.get(order.eventId) ?? []
        bucket.push(seeded)
        ordersByEvent.set(order.eventId, bucket)
    }

    for (const [eventId, orders] of ordersByEvent) {
        try {
            const sortedOrders = [...orders].sort((a, b) => a.createdAt - b.createdAt)
            const book = new OrderBook()
            book.seedOrders(sortedOrders)
            books.set(eventId, book)
            publishDepth(eventId)
        } catch (err) {
            logger.error({ err, eventId }, "Failed to hydrate order book from DB")
        }
    }

    logger.info({ hydratedEvents: ordersByEvent.size, hydratedOrders: openOrders.length }, "Hydrated order books from DB")
}

router.use(requireAdmin)

router.post("/admin/event", zodHandler({ body: eventCreateSchema }), async (req: AuthRequest, res) => {
    try {
        const payload = req.validated?.body as z.infer<typeof eventCreateSchema>
        const ev = await prisma.event.create({ data: payload })
        const decimals = DEFAULT_DECIMALS
        const qty = payload.liquidity ?? 1000
        const userId= req.userId as string
        const price=5.0
        const priceMinor = toMinorUnits(price, decimals)
        const stakeMinor = priceMinor * BigInt(qty)
        await prisma.$transaction(async (tx) => {
           const orderYes=await tx.order.create({
                data: {
                    side: "YES",
                    userId,
                    status: "OPEN",

                    id: randomUUID(),

                    pricePaise: priceMinor.toString(),
                    decimal: decimals,
                    qty,
                    openQty: qty,
                    eventId: ev.id,

                }
            })
             const orderNo=await tx.order.create({
                data: {
                    side: "NO",
                    userId: req.userId as string,
                    status: "OPEN",

                    id: randomUUID(),

                    pricePaise: priceMinor.toString(),
                    decimal: decimals,
                    qty,
                    openQty: qty,
                    eventId: ev.id,

                }
            })
           getBook(ev.id).seedOrders([{
                id: orderYes.id, userId, side:orderYes.side, price, qty, createdAt: Date.now(), isExit:false,
            },{
                id: orderNo.id, userId, side:orderNo.side, price, qty, createdAt: Date.now(), isExit:false,
            }])

        })


        res.status(201).json(ev)
    } catch (err) {
        logger.error({ err }, "Admin event creation failed")
        res.status(500).json({ error: "internal_error" })
    }
})

router.get("/admin/event", async (_req, res) => {
    const events = await prisma.event.findMany()
    res.status(200).json(events)
})

const updateEvent = async (req: AuthRequest, res: express.Response) => {
    try {
        const { id } = req.validated?.params as z.infer<typeof cancelSchema>
        const payload = req.validated?.body as z.infer<typeof eventUpdateSchema>
        const wantsSettle = payload.status === "SETTLED"
        if (wantsSettle) {
            const existing = await prisma.event.findUnique({ where: { id } })
            if (!existing) {
                res.status(404).json({ error: "not_found" })
                return
            }
            if (existing.status === "SETTLED") {
                res.status(200).json(existing)
                return
            }
            const resolvedOutcome = normalizeOutcome(payload.outcome ?? existing.outcome)
            if (!resolvedOutcome) {
                res.status(400).json({ error: "outcome_required" })
                return
            }
            const ev = await prisma.$transaction(async (tx) => {
                await settleEventPositions(tx, id, resolvedOutcome)
                return tx.event.update({
                    where: { id },
                    data: {
                        ...payload,
                        status: "SETTLED",
                        outcome: resolvedOutcome,
                    },
                })
            })
            books.set(id, new OrderBook())
            publishDepth(id)
            res.status(200).json(ev)
            return
        }

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
        ])
    } catch (err) {
        logger.warn({ err, eventId: id }, "Event cleanup failed")
    }

    res.status(200).json({ ok: true })
})

export default router
