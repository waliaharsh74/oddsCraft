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

const AUTH_QUERY_KEYS = ["token", "accessToken", "access_token"] as const;

const firstHeaderValue = (value?: string | string[]) =>
    Array.isArray(value) ? value[0] : value;

const getRequestScheme = (req: any) => {
    const forwardedProto = firstHeaderValue(req?.headers?.["x-forwarded-proto"]);
    if (forwardedProto) {
        const proto = forwardedProto.split(",")[0]?.trim().toLowerCase();
        if (proto === "https" || proto === "wss") return "wss";
        return "ws";
    }
    return req?.socket?.encrypted ? "wss" : "ws";
};

const getRequestHost = (req: any) =>
    firstHeaderValue(req?.headers?.["x-forwarded-host"]) ||
    firstHeaderValue(req?.headers?.host) ||
    "localhost";

const isLikelyJwt = (value: string) => value.split(".").length === 3;

const getTokenFromAuthorization = (value?: string | string[]) => {
    const raw = firstHeaderValue(value);
    if (!raw) return;
    const match = raw.match(/^Bearer\s+(.+)$/i);
    return (match?.[1] ?? raw).trim() || undefined;
};

const getTokenFromProtocols = (value?: string | string[]) => {
    const raw = firstHeaderValue(value);
    if (!raw) return;
    const parts = raw
        .split(",")
        .map(part => part.trim())
        .filter(Boolean);
    for (const part of parts) {
        if (/^bearer\s+/i.test(part)) {
            const token = part.replace(/^bearer\s+/i, "").trim();
            if (token) return token;
        }
        if (isLikelyJwt(part)) return part;
    }
};

const getTokenFromQuery = (url: URL) => {
    for (const key of AUTH_QUERY_KEYS) {
        const token = url.searchParams.get(key);
        if (token) return token;
    }
};

const getAuthToken = (req: any, url: URL) => {
    const cookies = cookie?.parse(req?.headers?.cookie || "");
    const cookieToken = cookies?.[ACCESS_TOKEN];
    if (cookieToken) return { token: cookieToken, source: "cookie" };

    const headerToken = getTokenFromAuthorization(req?.headers?.authorization);
    if (headerToken) return { token: headerToken, source: "authorization" };

    const queryToken = getTokenFromQuery(url);
    if (queryToken) return { token: queryToken, source: "query" };

    const protocolToken = getTokenFromProtocols(req?.headers?.["sec-websocket-protocol"]);
    if (protocolToken) return { token: protocolToken, source: "sec-websocket-protocol" };
    return {};
};

const buildRequestLog = (req: any) => ({
    method: req?.method,
    url: req?.url,
    remoteAddress: req?.socket?.remoteAddress,
    remotePort: req?.socket?.remotePort,
    headers: {
        host: firstHeaderValue(req?.headers?.host),
        "x-forwarded-host": firstHeaderValue(req?.headers?.["x-forwarded-host"]),
        "x-forwarded-proto": firstHeaderValue(req?.headers?.["x-forwarded-proto"]),
        "x-forwarded-for": firstHeaderValue(req?.headers?.["x-forwarded-for"]),
        "x-real-ip": firstHeaderValue(req?.headers?.["x-real-ip"]),
        origin: firstHeaderValue(req?.headers?.origin),
        "user-agent": firstHeaderValue(req?.headers?.["user-agent"]),
        "sec-websocket-protocol": firstHeaderValue(req?.headers?.["sec-websocket-protocol"]),
    },
    hasCookie: Boolean(req?.headers?.cookie),
});

const truncateLogValue = (value: string, max = 500) =>
    value.length > max ? `${value.slice(0, max)}...[truncated]` : value;

const formatWsMessage = (data: any, isBinary?: boolean) => {
    if (isBinary) {
        const length = typeof data?.length === "number" ? data.length : undefined;
        return `<binary${length ? ` ${length}b` : ""}>`;
    }
    try {
        return truncateLogValue(String(data));
    } catch {
        return "<unprintable>";
    }
};














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
        const scheme = getRequestScheme(req);
        const host = getRequestHost(req);
        const url = new URL(req.url || '/', `${scheme}://${host}`);
        const eventId = url.searchParams.get('eventId');

        const { token, source: tokenSource } = getAuthToken(req, url);

        console.log('[WS] connection attempt', {
            scheme,
            host,
            eventId,
            tokenSource,
            request: buildRequestLog(req),
        });

        if (!eventId) {
            console.warn('[WS] missing eventId', { url: url.toString() });
        }

        if (!token) {
            console.warn('[WS] unauthorized: missing token', { tokenSource });
            ws.close(4001, 'unauthorized');
            return;
        }

        try {
            ws.user = jwt.verify(token, JWT_SECRET);
        } catch {
            console.warn('[WS] unauthorized: invalid token', { tokenSource });
            ws.close(4001, 'unauthorized');
            return;
        }

        ws.eventId = eventId;
        console.log('[WS] connection accepted', {
            eventId,
            userId: ws?.user?.id ?? ws?.user?.userId,
            clients: wss.clients.size,
        });

        await hydrateEventCache(eventId);

        if (eventId && lastDepth.has(eventId)) {
            ws.send(JSON.stringify({ type: 'depth', payload: lastDepth.get(eventId) }));
            console.log('[WS] sent cached depth', { eventId });
        }
        if (eventId && lastPricing.has(eventId)) {
            ws.send(JSON.stringify({ type: 'pricing', payload: lastPricing.get(eventId) }));
            console.log('[WS] sent cached pricing', { eventId });
        }

        ws.isAlive = true;
        ws.on("message", (data: any, isBinary: boolean) => {
            console.log('[WS] client message', {
                eventId: ws.eventId,
                userId: ws?.user?.id ?? ws?.user?.userId,
                isBinary: Boolean(isBinary),
                payload: formatWsMessage(data, isBinary),
            });
            ws.send(JSON.stringify({ msg: "Hello!" }))
        })
        ws.on('pong', () => (ws.isAlive = true));
        ws.on('error', (data:any) => {
            console.log("error in connecting to websocket server:", data)

        })
        ws.on('close', (code: number, reason: Buffer) => {
            console.log('[WS] connection closed', {
                eventId: ws.eventId,
                userId: ws?.user?.id ?? ws?.user?.userId,
                code,
                reason: reason?.toString(),
            });
        });
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
