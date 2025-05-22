import { WebSocketServer } from 'ws';
import Redis from 'ioredis';
import 'dotenv/config'
const sub = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const port = process.env.PORT! as unknown as number 

const wss = new WebSocketServer({ port:port});
console.log('WS gateway on'+ port);

let lastDepth: any = null;

sub.subscribe('trade', 'depth', err => {
    if (err) console.error('Redis sub error', err);
});

sub.on('message', (channel, message) => {
    const payload = JSON.parse(message);
    if (channel === 'depth') lastDepth = payload;
    const msg = JSON.stringify({ type: channel, payload });
    wss.clients.forEach(c => c.readyState === 1 && c.send(msg));
});

wss.on('connection', ws => {
    if (lastDepth) ws.send(JSON.stringify({ type: 'depth', payload: lastDepth }));
});