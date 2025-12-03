import { WebSocketServer } from 'ws';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import 'dotenv/config';
import cookie from "cookie"
const PORT = Number(process.env.PORT || 4000);
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const JWT_SECRET = process.env.ACCESS_JWT_SECRET || '';     

const sub = new Redis(REDIS_URL, {
    retryStrategy: a => Math.min(a * 200, 2_000),
});
sub.subscribe('trade', 'depth', err =>
    err && console.error('[WS] Redis sub error', err)
);

const wss = new WebSocketServer({ port: PORT });
console.log('[WS] gateway on', PORT);

const lastDepth = new Map<string, any>();

sub.on('message', (_, raw) => {
    const { eventId, trades, depth } = JSON.parse(raw);

    if (depth) lastDepth.set(eventId, depth);

    wss.clients.forEach((c: any) => {
        if (c.readyState !== 1 || c.eventId !== eventId) return;

        if (trades) c.send(JSON.stringify({ type: 'trade', payload: trades }));
        if (depth) c.send(JSON.stringify({ type: 'depth', payload: depth }));
    });
});

wss.on('connection', (ws: any, req) => {
    const url = new URL(req.url || '/', `ws://${req.headers.host}`);
    const eventId = url.searchParams.get('eventId');
       const cookies = cookie.parse(req.headers.cookie || '');
    const token = cookies['access_token'];

    if (JWT_SECRET) {
        try { jwt.verify(token || '', JWT_SECRET); }
        catch { ws.close(4001, 'unauthorized'); return; }
    }

    ws.eventId = eventId;

    if (eventId && lastDepth.has(eventId)) {
        ws.send(JSON.stringify({ type: 'depth', payload: lastDepth.get(eventId) }));
    }

    ws.isAlive = true;
    ws.on('pong', () => (ws.isAlive = true));
});

setInterval(() => {
    wss.clients.forEach((ws: any) => {
        if (ws.isAlive === false) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
    });
}, 30_000);
