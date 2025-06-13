import type { Side, OrderInMem, TradeMsg } from "./types"
import { randomUUID } from "crypto";
import { EventEmitter } from "events";

const TICK_SIZE = 0.1;                     
const FACE_MIN = 0.0 + TICK_SIZE;          
const FACE_MAX = 10.0 - TICK_SIZE;         
const MAX_LEVELS = 200

function roundToTick(raw: number) {
    return Math.round(raw / TICK_SIZE) * TICK_SIZE;
}

function assertValid(price: number, qty: number) {
    if (qty <= 0 || !Number.isFinite(qty)) throw new Error("bad_qty");
    const norm = roundToTick(price);
    if (Math.abs(norm - price) > 1e-9) throw new Error("bad_tick");
    if (norm < FACE_MIN || norm > FACE_MAX) throw new Error("bad_price");
}

export class BookLevel {
    constructor(public price: number, public orders: OrderInMem[] = []) { }
}

export class OrderBook extends EventEmitter {
    bids = new Map<number, BookLevel>();
    asks = new Map<number, BookLevel>(); 

    depth(side: Side) {
        const map = side === "YES" ? this.bids : this.asks;
        const rows = [...map.values()].map((lvl) => ({
            price: lvl.price,
            qty: lvl.orders.reduce((s, o) => s + o.qty, 0),
        }));
        return rows.sort((a, b) => (side === "YES" ? b.price - a.price : a.price - b.price));
    }

    addOrder(o: OrderInMem): TradeMsg[] {
        assertValid(o.price, o.qty);
        if (o.isExit) {                     
            this.addLevel(o.side === 'YES' ? this.bids : this.asks, o);
            this.emitDepth();                 
            return [];
        }

        o = { ...o, price: roundToTick(o.price) };

        const oppPrice = Number((10 - o.price).toFixed(1));   
        const myMap = o.side === 'YES' ? this.bids : this.asks;
        const oppMap = o.side === 'YES' ? this.asks : this.bids;
        const lvl = oppMap.get(oppPrice);
        const trades: TradeMsg[] = [];

        let remaining = o.qty;

        while (remaining && lvl && lvl.orders.length>0) {
            const maker = lvl.orders[0]!;
            const fill = Math.min(remaining, maker.qty);

            maker.qty -= fill;
            remaining -= fill;

            trades.push({
                tradeId: randomUUID(),
                side: o.side,
                price: o.price,
                qty: fill,
                taker: o.userId,
                maker: maker.userId,
                makerOrderId: maker.id,
                remainingMakerQty: maker.qty,
                ts: Date.now(),
            });

            if (maker.qty === 0) lvl.orders.shift();
        }

        if (lvl && lvl.orders.length === 0) oppMap.delete(oppPrice);

        if (remaining) this.addLevel(myMap, { ...o, qty: remaining });

        if (trades.length) this.emit('trade', trades);
        this.emitDepth();
        return trades;
    }

    private emitDepth() {
        this.emit('depth', { bids: this.depth('YES'), asks: this.depth('NO') });
    }
      

    cancel(id: string): boolean {
        for (const map of [this.bids, this.asks]) {
            for (const lvl of map.values()) {
                const idx = lvl.orders.findIndex((o) => o.id === id);
                if (idx !== -1) {
                    lvl.orders.splice(idx, 1);
                    if (lvl.orders.length === 0) map.delete(lvl.price);
                    this.emit("depth", { bids: this.depth("YES"), asks: this.depth("NO") });
                    return true;
                }
            }
        }
        return false;
      }

    private addLevel(map: Map<number, BookLevel>, o: OrderInMem) {
        let lvl = map.get(o.price);
        if (!lvl) {
            lvl = new BookLevel(o.price);
            map.set(o.price, lvl);
        }
        lvl.orders.push(o);
    }

    private bestPrice(
        map: Map<number, BookLevel>,
        cmp: (p: number) => boolean
    ): number | undefined {
        let best: number | undefined;
        for (const p of map.keys())
            if (cmp(p) && (best === undefined || (cmp === ((x: number) => x <= x) ? p < best! : p > best!)))
                best = p;
        return best;
    }

 
    private prune(map: Map<number, BookLevel>) {
        if (map.size <= MAX_LEVELS) return;
      
        const worst = [...map.keys()].sort((a, b) => (map === this.bids ? a - b : b - a))[0]!;
        map.delete(worst);
      }
  }

