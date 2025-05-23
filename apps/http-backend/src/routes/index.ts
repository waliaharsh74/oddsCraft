import express, { Router } from "express"
import { prisma, OrderSide } from "@repo/db"
import Redis from 'ioredis';

import { randomUUID } from "crypto";
import { Side, TradeMsg, OrderBook, signupSchema, signinSchema, cancelSchema, orderSchema } from "@repo/common"
import bcrypt from "bcryptjs"

import { EventEmitter } from 'events';
import { validate ,sign} from "../middlewares";
const router:Router = express.Router()
const book = new OrderBook();
const bus = new EventEmitter();
const pub = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

function publish(channel: string, payload: unknown) {
    pub.publish(channel, JSON.stringify(payload));
}

bus.on('trade', (trades: TradeMsg[]) => publish('trade', trades));
bus.on('depth', (d: any) => publish('depth', d));

router.post("/auth/signup",validate(signupSchema), async (req, res) => {
    const { email, password } = req.body as {email:string,password:string};
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists){  res.status(400).json({ error: "email_taken" });return}
    const user = await prisma.user.create({ data: { id: randomUUID(), email, passwordHash: await bcrypt.hash(password, 10) } });
    res.json({ token: sign(user.id) });
});

router.post("/auth/signin", validate(signinSchema),async (req, res) => {
    try {
        
        const { email, password } = req.body;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !(await bcrypt.compare(password, user.passwordHash))) { res.status(401).json({ error: "invalid" });return}
        res.json({ token: sign(user.id) });
    } catch (error) {
        
    }
});
router.post("/orders", async (req, res) => {
    try {
        const { userId, side, price, qty } = req.body as { userId: string; side: Side; price: number; qty: number };
        if (price < 0 || price > 10) {
            res.status(400).json({ error: "price out of range" })
            return
        }
        const stake = price * qty;

        const result = await prisma.$transaction(async (tx) => {
            const user = await tx.user.update({ where: { id: userId }, data: {} }); 
            if (user.balance < stake) throw new Error("FUNDS");
            await tx.user.update({ where: { id: userId }, data: { balance: { decrement: stake } } });

            const dbOrder = await tx.order.create({
                data: {
                    id: randomUUID(),
                    userId,
                    side: side as OrderSide,
                    price: Math.round(price * 100),
                    qty,
                    openQty: qty,
                    status: "OPEN",
                }
            });

            const trades = book.addOrder({ id: dbOrder.id, userId, side, price, qty, createdAt: Date.now() });

            for (const t of trades) {
                await tx.trade.create({
                    data: {
                        id: t.tradeId,
                        orderAggressorId: dbOrder.id,
                        price: Math.round(t.price * 100),
                        qty: t.qty,
                        takerId: t.taker,
                        makerId: t.maker,
                    }
                });
                const makerStake = t.price * t.qty;
                await tx.user.update({ where: { id: t.maker }, data: { balance: { increment: makerStake } } });
                await tx.order.update({ where: { id: t.maker }, data: { openQty: { decrement: t.qty }, status: "FILLED" } });
            }
            const filled = trades.reduce((s, t) => s + t.qty, 0);
            await tx.order.update({ where: { id: dbOrder.id }, data: filled === qty ? { openQty: 0, status: "FILLED" } : { openQty: qty - filled } });
            return { dbOrder, trades };
        });

        bus.emit("trade", result.trades);
        bus.emit("depth", { bids: book.depth("YES"), asks: book.depth("NO") });

        res.json({ orderId: result.dbOrder.id, trades: result.trades });
    } catch (e: any) {
        if (e?.message === "FUNDS") { res.status(400).json({ error: "insufficient balance" }); return }
        console.error(e);
        res.status(500).json({ error: "server error" });
    }
});

router.delete("/orders/:id", async (req, res) => {
    const id = req.params.id;
    const ok = book.cancel(id);
    if (!ok) {
        res.status(404).json({ error: "not found" });
        return
    }
    await prisma.order.update({ where: { id }, data: { status: "CANCELLED", openQty: 0 } }).catch(() => { });
    bus.emit("depth", { bids: book.depth("YES"), asks: book.depth("NO") });
    res.json({ ok: true });
});

router.get("/depth", (_req, res) => {
    res.json({ bids: book.depth("YES"), asks: book.depth("NO") });
});

export default router