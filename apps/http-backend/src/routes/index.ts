import express, { Router } from "express"
import { prisma, OrderSide,OrderStatus,Role,EventStatus } from "@repo/db"
import Redis from 'ioredis';
import { Response } from "express";
import rateLimit from "express-rate-limit"
import { randomUUID } from "crypto";
import { Side, TradeMsg, OrderBook, signupSchema, signinSchema, cancelSchema, orderSchema, balanceSchema, eventCreateSchema, eventUpdateSchema, EventSchema } from "@repo/common"
import bcrypt from "bcryptjs"

import { EventEmitter } from 'events';
import { sign, auth, requireAdmin } from "../middlewares";
import { AuthRequest } from "../interfaces";
const router: Router = express.Router()

const books = new Map<string, OrderBook>();

function getBook(eventId: string) {
    if (!books.has(eventId)) books.set(eventId, new OrderBook());
    return books.get(eventId)!;
}
function publishDepth(eventId: string) {
    const book = books.get(eventId);
    if (!book) return;
    bus.emit('depth', {
        eventId,
        depth: { bids: book.depth('YES'), asks: book.depth('NO') },
    });
}

function publishTrades(eventId: string, trades: TradeMsg[]) {
    bus.emit('trade', { eventId, trades });
}

const bus = new EventEmitter();
const pub = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

function publish(channel: string, payload: unknown) {
    pub.publish(channel, JSON.stringify(payload));
}

bus.on('trade', (trades: TradeMsg[]) => publish('trade', trades));
bus.on('depth', (d: any) => publish('depth', d));

// router.use(
//     rateLimit({
//         windowMs: 15 * 60_000,
//         max: 60,
//     })
// )
router.get("/hello", async (req, res) => {
    res.json({ msg: "hello" });


});
router.post("/auth/signup", async (req, res) => {
    try {
        const result = signupSchema.safeParse(req.body);
        if (!result.success) {
            res.status(400).json({ error: result.error.flatten() })
            return
        };
        const { email, password } = req.body as { email: string, password: string };
        const exists = await prisma.user.findUnique({ where: { email } });
        if (exists) { res.status(400).json({ error: "email already registered" }); return }
        const user = await prisma.user.create({ data: { id: randomUUID(), email, passwordHash: await bcrypt.hash(password, 10) } });
        res.json({
            id: user.id,
            msg: "User Registered Successfully!"
        });
    } catch (error) {
        console.log(error);
    }

});
router.post("/auth/signin", async (req, res) => {
    try {
        const result = signinSchema.safeParse(req.body);
        if (!result.success) {
            res.status(400).json({ error: result.error.flatten() })
            return
        };
        const { email, password } = req.body;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !(await bcrypt.compare(password, user.passwordHash))) { res.status(401).json({ error: "Invalid Credentials" }); return }
        const data = {
            id: user.id,
            role: user.role
        }
        const toSignString = JSON.stringify(data)
        res.json({
            token: sign(toSignString),
            msg: "Welcome Back!"
        });
    } catch (error) {
        console.log(error);
    }
});

router.use(auth);
router.get('/events', async (req, res) => {
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
        });
        res.json(events);
    } catch (error) {
        res.status(500).json({
            error: "Internal Server Error!"
        })
    }

});

router.post('/orders', async (req: AuthRequest, res) => {
    try {
        const parsed = orderSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: parsed.error.flatten() })
            return
        };

        const { eventId, side, price, qty } = parsed.data;
        const userId = req.userId as string;

        const eventRow = await prisma.event.findUnique({ where: { id: eventId } });
        if (!eventRow || eventRow.status !== 'OPEN') {

            res.status(404).json({ error: 'event_closed_or_missing' });
            return
        }

        const stakePaise = Math.round(price * 100) * qty;

        const result = await prisma.$transaction(async (tx) => {

            const dbOrder = await tx.order.create({
                data: {
                    id: randomUUID(),
                    userId,
                    side: side as OrderSide,
                    pricePaise: Math.round(price * 100),
                    qty,
                    openQty: qty,
                    status: 'OPEN',
                    eventId,                            
                },
            });

            const trades = getBook(eventId).addOrder({
                id: dbOrder.id, userId, side, price, qty, createdAt: Date.now(),
            });


            return { dbOrder, trades };
        });

        bus.emit('trade', { eventId, trades: result.trades });
        bus.emit('depth', {
            eventId, depth: {
                bids: getBook(eventId).depth('YES'),
                asks: getBook(eventId).depth('NO')
            }
        });

        res.json({ orderId: result.dbOrder.id, trades: result.trades });
    } catch (e: any) {
        if (e?.message === 'FUNDS') {
            res.status(400).json({ error: 'insufficient_balance' });
            return
        }
        console.error(e);
        res.status(500).json({ error: 'server_error' });
    }
});

router.get("/me/balance", async (req: AuthRequest, res) => {

    try {
        const userId = req.userId as string;
        const balance = await prisma.user.findFirst({
            where: {
                id: userId
            }
        })
        // console.log(balance);
        if (!balance) {
            res.status(404).json({ error: "Can't find the User", });
            return
        }
        const amt = Number(balance?.balancePaise) / 100;
        res.json({ msg: "Balance ", balance: amt });

    } catch (e: any) {
        console.error(e);

        res.status(500).json({ error: "server error!" });
    }
});
router.get("/me/orders", async (req: AuthRequest, res) => {

    try {
        const userId = req.userId as string;
        const status = (req.query.status as OrderStatus || 'OPEN').toUpperCase();

        const where = { userId } as any;
        if (status !== 'ALL') where.status = status;

        const orders = await prisma.order.findMany({
            where,
            select: {
                id: true, eventId: true, side: true, pricePaise: true, qty: true,
                openQty: true, status: true, createdAt: true
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json(orders);

    } catch (e: any) {
        console.error(e);

        res.status(500).json({ error: "server error!" });
    }
});
router.get("/me/trades", async (req: AuthRequest, res) => {

    try {
        const userId = req.userId as string;
        const trades = await prisma.trade.findMany({
            where: { OR: [{ makerId: userId }, { takerId: userId }] },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
        res.json(trades);

    } catch (e: any) {
        console.error(e);

        res.status(500).json({ error: "server error!" });
    }
});
router.post("/wallet/topup", async (req: AuthRequest, res) => {

    try {
        const userId = req.userId as string;
        console.log(balanceSchema);
        const parsed = balanceSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: parsed.error.flatten() })
            return
        };
        const { amt } = req.body as { amt: number };
        const userDetails = await prisma.user.update({
            where: {
                id: userId
            },
            data: {
                balancePaise: {
                    increment: amt * 100
                }
            }
        })
        if (!userDetails) {
            res.status(404).json({ error: "Can't Increase the balance", });
        }
        res.json({ msg: "Balance Increased " });

    } catch (e: any) {
        console.error(e);

        res.status(500).json({ error: "server error!" });
    }
});
router.delete("/orders/:id", async (req: AuthRequest, res) => {
    try {
        const result = cancelSchema.safeParse({ params: req?.params });
        if (!result.success) {
            res.status(400).json({ error: result.error.flatten() })
            return
        };
        const id = result.data.params;
        const userId = req.userId as string;

        const row = await prisma.order.findUnique({ where: { id } });
        if (!row || row.userId !== userId || row.status !== "OPEN") {
            res.status(404).json({ error: "not_found" });
            return
        }
        const ok = getBook(row.eventId).cancel(id);
        if (!ok) {
            res.status(410).json({ error: "already_matched" });
            return
        }
        await prisma.order.update({
            where: { id },
            data: { status: "CANCELLED", openQty: 0 },
        });

        publishDepth(row.eventId);
        res.json({ ok: true });
    } catch (error) {

    }

});


router.get("/depth", (req, res) => {
    const eventId = req.query.eventId as string | undefined;
    if (!eventId) {
        res.status(400).json({ error: 'eventId_required' });
        return
    }

    const book = books.get(eventId);
    if (!book) {
        res.json({ bids: [], asks: [] })
        return
    };

    res.json({ bids: book.depth('YES'), asks: book.depth('NO') });
});
router.get("/probability", (req, res) => {
    const eventId = req.query.eventId as string | undefined;
    if (!eventId) {
        res.status(400).json({ error: 'eventId_required' })
        return
    };
    const book = books.get(eventId);
    if (!book) {
        res.json({ probability: 0.5 });
        return
    }

    const bestBid = book.depth('YES')[0]?.price ?? 0;
    const bestAsk = book.depth('NO')[0]?.price ?? 10;
    res.json({ probability: (bestBid + bestAsk) / 20 });
});

router.use(requireAdmin)

router.post('/admin/event', async (req, res) => {
    const parsed = eventCreateSchema.safeParse(req.body)
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() })
        return
    }
    const ev = await prisma.event.create({ data: parsed.data });
    res.json(ev);
});

router.get('/admin/event', async (_req, res) => {
    const events = await prisma.event.findMany();
    res.json(events);
});

router.post('/admin/event/:id', async (req, res) => {
    const parsed = eventUpdateSchema.safeParse(req.body)
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() })
        return
    }
    const ev = await prisma.event.update({ where: { id: req.params.id }, data: { status: parsed.data.status } });
    res.json(ev);
});

export default router