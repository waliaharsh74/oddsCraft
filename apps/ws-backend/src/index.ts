import { WebSocketServer } from 'ws';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import dotenv from "dotenv";
import * as cookie from "cookie";
import { prisma } from '@repo/db';
import { ACCESS_TOKEN, REDIS_CHANNELS, redisKeys } from '@repo/common';
import type { MarketMakerSnapshot } from '@repo/common';
dotenv.config()

const PORT = Number(process.env.PORT || 4000);
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const JWT_SECRET = process.env.ACCESS_JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('ACCESS_JWT_SECRET missing for WS authentication');
}

const redis = new Redis(REDIS_URL, {
    retryStrategy: a => Math.min(a * 200, 2_000),
});
const sub = new Redis(REDIS_URL, {
    retryStrategy: a => Math.min(a * 200, 2_000),
});
sub.subscribe(REDIS_CHANNELS.trade, REDIS_CHANNELS.depth, REDIS_CHANNELS.pricing, err =>
    err && console.error('[WS] Redis sub error', err)
);

const wss = new WebSocketServer({ port: PORT });
console.log('[WS] gateway on', PORT);

const lastDepth = new Map<string, any>();
const lastPricing = new Map<string, any>();
const DEFAULT_DECIMALS = 2;

const fromMinorUnits = (value: string | number, decimal = DEFAULT_DECIMALS) =>
    Number(BigInt(String(value))) / Math.pow(10, decimal);

const buildPricingPayload = (state: MarketMakerSnapshot) => {
    const decimals = state.decimals ?? DEFAULT_DECIMALS;
    return {
        eventId: state.eventId,
        state,
        priceYes: fromMinorUnits(state.priceYesPaise, decimals),
        priceNo: fromMinorUnits(state.priceNoPaise, decimals),
    };
};


// const hydrateMarketMakerCacheFromDb = async (eventId?: string | null) => {
//     try {
//         const rows = await prisma.marketMakerState.findMany(
//             eventId ? { where: { eventId } } : undefined
//         );
//         await Promise.all(rows.map(async (row) => cacheMarketMakerState(mapDbStateToSnapshot(row))));
//     } catch (err) {
//         console.error('[WS] Failed to hydrate market maker cache from DB', err);
//     }
// };

// hydrateMarketMakerCacheFromDb().catch((err) => console.error('[WS] Startup market maker cache hydration failed', err));

const hydrateEventCache = async (eventId?: string | null) => {
    if (!eventId) return;
    try {
        if (!lastDepth.has(eventId)) {
            const storedDepth = await redis.get(redisKeys.lastDepth(eventId));
            if (storedDepth) {
                const parsedDepth = JSON.parse(storedDepth);
                const depthPayload = parsedDepth.depth ?? parsedDepth;
                lastDepth.set(eventId, depthPayload);
            }
        }

        if (!lastPricing.has(eventId)) {
            const storedPricing = await redis.get(redisKeys.lastPricing(eventId));
            if (storedPricing) {
                lastPricing.set(eventId, JSON.parse(storedPricing));
            } else {
                const mmStateRaw = await redis.get(redisKeys.marketMakerState(eventId));
                if (mmStateRaw) {
                    const mmState = JSON.parse(mmStateRaw) as MarketMakerSnapshot;
                    const pricingPayload = buildPricingPayload(mmState);
                    lastPricing.set(eventId, pricingPayload);
                    await redis.set(redisKeys.lastPricing(eventId), JSON.stringify(pricingPayload));
                } 
            }
        }
    } catch (err) {
        console.error('[WS] Failed to hydrate event cache from Redis', err);
    }
};

sub.on('message', (channel, raw) => {
    const parsed = JSON.parse(raw);
    if (channel === REDIS_CHANNELS.pricing) {
        const { eventId } = parsed;
        if (eventId) lastPricing.set(eventId, parsed);

        wss.clients.forEach((c: any) => {
            if (c.readyState !== 1 || c.eventId !== eventId) return;
            c.send(JSON.stringify({ type: 'pricing', payload: parsed }));
        });
        return;
    }
    const { eventId, trades, depth } = parsed;
    if (!eventId) return;

    if (depth) lastDepth.set(eventId, depth);

    wss.clients.forEach((c: any) => {
        if (c.readyState !== 1 || c.eventId !== eventId) return;

        if (trades) c.send(JSON.stringify({ type: 'trade', payload: trades }));
        if (depth) c.send(JSON.stringify({ type: 'depth', payload: depth }));
    });
});


wss.on('connection', async (ws: any, req) => {
    try {
        const url = new URL(req.url || '/', `ws://${req.headers.host}`);
        const eventId = url.searchParams.get('eventId');

        const cookies = cookie?.parse(req?.headers?.cookie || '');
        const token = cookies[ACCESS_TOKEN];

        if (!token) {
            ws.close(4001, 'unauthorized');
            return;
        }

        try {
            jwt.verify(token, JWT_SECRET);
        } catch {
            ws.close(4001, 'unauthorized');
            return;
        }

        ws.eventId = eventId;

        await hydrateEventCache(eventId);

        if (eventId && lastDepth.has(eventId)) {
            ws.send(JSON.stringify({ type: 'depth', payload: lastDepth.get(eventId) }));
        }
        if (eventId && lastPricing.has(eventId)) {
            ws.send(JSON.stringify({ type: 'pricing', payload: lastPricing.get(eventId) }));
        }

        ws.isAlive = true;
        ws.on("message", () => {
            ws.send(JSON.stringify({ msg: "Hello!" }))
        })
        ws.on('pong', () => (ws.isAlive = true));
        ws.on('error', (data:any) => {
            console.log("error in connecting to websocket server:", data)

        })
    } catch (error) {
        console.log('err',error);       
    }    
});

setInterval(() => {
    wss.clients.forEach((ws: any) => {
        if (ws.isAlive === false) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
    });
}, 30_000);
