import type { Side, OrderInMem, TradeMsg } from "./types"
import { randomUUID } from "crypto";



export class BookLevel {
    constructor(public price: number, public orders: OrderInMem[] = []) { }
}

export class OrderBook {
    bids = new Map<number, BookLevel>();
    asks = new Map<number, BookLevel>(); 

    private add(map: Map<number, BookLevel>, o: OrderInMem) {
        const lvl = map.get(o.price) ?? new BookLevel(o.price);
        lvl.orders.push(o);
        map.set(o.price, lvl);
    }
    private best(map: Map<number, BookLevel>, cmp: (a: number, b: number) => boolean) {
        let best: number | undefined;
        for (const p of map.keys()) if (best === undefined || cmp(p, best)) best = p;
        return best;
    }
    depth(side: Side) {
        const map = side === "YES" ? this.bids : this.asks;
        const rows = [...map.values()].map((lvl) => ({
            price: lvl.price,
            qty: lvl.orders.reduce((s, o) => s + o.qty, 0),
        }));
        return rows.sort((a, b) => (side === "YES" ? b.price - a.price : a.price - b.price));
    }

    addOrder(o: OrderInMem): TradeMsg[] {
        const trades: TradeMsg[] = [];
        const isBuy = o.side === "YES";
        const myMap = isBuy ? this.bids : this.asks;
        const oppMap = isBuy ? this.asks : this.bids;

        let remaining = o.qty;
        let bestOpp = this.best(oppMap, isBuy ? (a, b) => a < b : (a, b) => a > b);

        while (remaining > 0 && bestOpp !== undefined && (isBuy ? o.price >= bestOpp : o.price <= bestOpp)) {
            const lvl = oppMap.get(bestOpp)!;
            while (remaining && lvl.orders.length) {
                const makerOrder = lvl.orders[0]!;
                const fill = Math.min(remaining, makerOrder.qty);
                trades.push({
                    tradeId: randomUUID(),
                    side: o.side,
                    price: bestOpp,
                    qty: fill,
                    taker: o.userId,
                    maker: makerOrder.userId,
                    ts: Date.now(),
                });
                remaining -= fill;
                makerOrder.qty -= fill;
                if (makerOrder.qty === 0) lvl.orders.shift();
            }
            if (!lvl.orders.length) oppMap.delete(bestOpp);
            bestOpp = this.best(oppMap, isBuy ? (a, b) => a < b : (a, b) => a > b);
        }

        if (remaining) this.add(myMap, { ...o, qty: remaining });
        return trades;
    }

    cancel(id: string): boolean {
        for (const map of [this.bids, this.asks]) {
            for (const lvl of map.values()) {
                const idx = lvl.orders.findIndex((o) => o.id === id);
                if (idx !== -1) {
                    lvl.orders.splice(idx, 1);
                    if (!lvl.orders.length) map.delete(lvl.price);
                    return true;
                }
            }
        }
        return false;
    }
  }

