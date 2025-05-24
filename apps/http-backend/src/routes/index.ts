import express, { Router } from "express"
import { prisma, OrderSide } from "@repo/db"
import Redis from 'ioredis';
import { Response } from "express";
import rateLimit from "express-rate-limit"
import { randomUUID } from "crypto";
import { Side, TradeMsg, OrderBook, signupSchema, signinSchema, cancelSchema, orderSchema } from "@repo/common"
import bcrypt from "bcryptjs"

import { EventEmitter } from 'events';
import { validate, sign, auth } from "../middlewares";
import { AuthRequest } from "../interfaces";
const router: Router = express.Router()
const book = new OrderBook();
const bus = new EventEmitter();
const pub = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

function publish(channel: string, payload: unknown) {
    pub.publish(channel, JSON.stringify(payload));
}

bus.on('trade', (trades: TradeMsg[]) => publish('trade', trades));
bus.on('depth', (d: any) => publish('depth', d));
router.use(
    rateLimit({
        windowMs: 15 * 60_000,
        max: 60,
    })
)
router.post("/auth/signup", validate(signupSchema), async (req, res) => {
    const { email, password } = req.body as { email: string, password: string };
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) { res.status(400).json({ error: "email_taken" }); return }
    const user = await prisma.user.create({ data: { id: randomUUID(), email, passwordHash: await bcrypt.hash(password, 10) } });
    res.json({ token: sign(user.id) });
});

router.post("/auth/signin", validate(signinSchema), async (req, res) => {
    try {

        const { email, password } = req.body;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !(await bcrypt.compare(password, user.passwordHash))) { res.status(401).json({ error: "invalid" }); return }
        res.json({ token: sign(user.id) });
    } catch (error) {

    }
});
router.use(auth);
router.post("/orders", validate(orderSchema), async (req: AuthRequest, res) => {
    const { side, price, qty } = req.body as { side: Side; price: number; qty: number };
    const userId = req.userId as string;

    const stakePaise = Math.round(price * 100) * qty;

    try {
        const result = await prisma.$transaction(async (tx) => {

            const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
            if (user.balancePaise < stakePaise) throw new Error("FUNDS");

            await tx.user.update({
                where: { id: userId },
                data: { balancePaise: { decrement: stakePaise } },
            });

            // create order row
            const dbOrder = await tx.order.create({
                data: {
                    id: randomUUID(),
                    userId,
                    side: side as OrderSide,
                    pricePaise: Math.round(price * 100),
                    qty,
                    openQty: qty,
                    status: "OPEN",
                },
            });

            // run in-mem match
            const trades = book.addOrder({
                id: dbOrder.id,
                userId,
                side,
                price,
                qty,
                createdAt: Date.now(),
            });


            for (const t of trades) {
                await tx.trade.create({
                    data: {
                        id: t.tradeId,
                        orderAggressorId: dbOrder.id,
                        makerOrderId: t.makerOrderId,
                        pricePaise: Math.round(t.price * 100),
                        qty: t.qty,
                        takerId: t.taker,
                        makerId: t.maker,
                    },
                });

                const makerStakePaise = Math.round(t.price * 100) * t.qty;
                await tx.user.update({
                    where: { id: t.maker },
                    data: { balancePaise: { increment: makerStakePaise } },
                });

                await tx.order.update({
                    where: { id: t.makerOrderId },
                    data: {
                        openQty: { decrement: t.qty },
                        status: t.remainingMakerQty ? "OPEN" : "FILLED",
                    },
                });
            }

            // update taker (the new order) openQty
            const filled = trades.reduce((s, t) => s + t.qty, 0);
            await tx.order.update({
                where: { id: dbOrder.id },
                data: {
                    openQty: qty - filled,
                    status: filled === qty ? "FILLED" : "OPEN",
                },
            });

            return { dbOrder, trades };
        });

        bus.emit("trade", result.trades);
        bus.emit("depth", { bids: book.depth("YES"), asks: book.depth("NO") });

        res.json({ orderId: result.dbOrder.id, trades: result.trades });
    } catch (e: any) {
        console.error(e);
        if (e?.message === "FUNDS") {
            res.status(400).json({ error: "insufficient_balance" });
            return
        }

        res.status(500).json({ error: "server_error" });
    }
});


router.delete("/orders/:id", validate(cancelSchema), async (req: AuthRequest, res) => {
    const { id } = req?.params;
    const userId = req.userId as string;

    const row = await prisma.order.findUnique({ where: { id } });
    if (!row || row.userId !== userId || row.status !== "OPEN") {
        res.status(404).json({ error: "not_found" });
        return
    }
    const ok = book.cancel(id);
    if (!ok) {
        res.status(410).json({ error: "already_matched" });
        return
    }
    await prisma.order.update({
        where: { id },
        data: { status: "CANCELLED", openQty: 0 },
    });

    bus.emit("depth", { bids: book.depth("YES"), asks: book.depth("NO") });
    res.json({ ok: true });
});


router.get("/depth", (_req, res) => {
    res.json({ bids: book.depth("YES"), asks: book.depth("NO") });
});


router.get("/probability", (_req, res) => {
    const bestBid = book.depth("YES")[0]?.price ?? 0;
    const bestAsk = book.depth("NO")[0]?.price ?? 10;
    const mid = (bestBid + bestAsk) / 2;
    res.json({ probability: mid / 10 });
});

export default router