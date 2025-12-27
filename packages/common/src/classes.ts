import type { Side, OrderInMem, TradeMsg } from "./types"
import { randomUUID } from "crypto";
import { EventEmitter } from "events";

const TICK_SIZE = 0.1;                     
const FACE_MIN = 0.0;                      
const FACE_MAX = 10.0;                     
const MAX_LEVELS = 200

export function roundToTick(raw: number) {
    return Math.round(raw / TICK_SIZE) * TICK_SIZE;
}

export function assertValid(price: number, qty: number) {
    if (qty <= 0 || !Number.isFinite(qty)) throw new Error("bad_qty");
    if (!Number.isFinite(price)) throw new Error("bad_price");
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

    seedOrders(orders: OrderInMem[]) {
        for (const order of orders) {
            assertValid(order.price, order.qty)
            const rounded = roundToTick(order.price)
            const map = order.side === "YES" ? this.bids : this.asks
            this.addLevel(map, { ...order, price: rounded })
        }

        if (orders.length) this.emitDepth()
    }

    depth(side: Side) {
        const map = side === "YES" ? this.bids : this.asks;
        const rows = [...map.values()].map((lvl) => ({
            price: lvl.price,
            qty: lvl.orders.reduce((s, o) => s + o.qty, 0),
        }));
        return rows.sort((a, b) => b.price - a.price);
    }

    addOrder(
        o: OrderInMem,
        opts?: {
            maxCost?: bigint;
            costForFill?: (price: number, qty: number) => bigint;
            skipSelfTrade?: boolean;
        }
    ): TradeMsg[] {
        const isMarket = o.orderType === "MARKET";
        if (!isMarket) {
            assertValid(o.price, o.qty);
            o = { ...o, price: roundToTick(o.price) };
        } else {
            if (o.qty <= 0 || !Number.isFinite(o.qty)) throw new Error("bad_qty");
        }

        const myMap = o.side === "YES" ? this.bids : this.asks;
        const oppMap = o.side === "YES" ? this.asks : this.bids;
        const trades: TradeMsg[] = [];

        let remaining = o.qty;
        let remainingBudget = opts?.maxCost;
        const hasBudget = remainingBudget !== undefined && typeof opts?.costForFill === "function";
        const skipSelf = opts?.skipSelfTrade ?? true;

        if (remainingBudget !== undefined && !opts?.costForFill)
            throw new Error("missing_cost_fn");

        const minOppPrice = isMarket ? undefined : roundToTick(10 - o.price);
        const oppPrices = [...oppMap.keys()]
            .filter((p) => (isMarket ? true : p >= minOppPrice!))
            .sort((a, b) => b - a);

        for (const makerPrice of oppPrices) {
            const lvl = oppMap.get(makerPrice);
            if (!lvl) continue;

            while (remaining > 0 && lvl.orders.length > 0) {
                const makerIndex = skipSelf
                    ? lvl.orders.findIndex((maker) => maker.userId !== o.userId)
                    : 0;
                if (makerIndex === -1) break;

                const maker = lvl.orders[makerIndex]!;
                const takerPrice = roundToTick(10 - makerPrice);
                let fill = Math.min(remaining, maker.qty);

                if (hasBudget) {
                    const unitCost = opts!.costForFill!(takerPrice, 1);
                    if (unitCost < 0n) break;
                    if (unitCost > 0n) {
                        const affordable = remainingBudget! / unitCost;
                        if (affordable <= 0n) {
                            remaining = 0;
                            break;
                        }
                        const affordableQty = Math.min(fill, Number(affordable));
                        if (affordableQty <= 0) {
                            remaining = 0;
                            break;
                        }
                        fill = affordableQty;
                        remainingBudget = remainingBudget! - unitCost * BigInt(fill);
                    }
                }

                maker.qty -= fill;
                remaining -= fill;

                trades.push({
                    tradeId: randomUUID(),
                    side: o.side,
                    price: takerPrice,
                    qty: fill,
                    taker: o.userId,
                    maker: maker.userId,
                    makerOrderId: maker.id,
                    remainingMakerQty: maker.qty,
                    ts: Date.now(),
                });

                if (maker.qty === 0) lvl.orders.splice(makerIndex, 1);

            }

            if (lvl.orders.length === 0) oppMap.delete(makerPrice);
            if (!remaining) break;
        }

        if (remaining && !isMarket) this.addLevel(myMap, { ...o, qty: remaining });

        if (trades.length) this.emit("trade", trades);
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

