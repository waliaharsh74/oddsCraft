// "use client";

// import { useEffect, useRef, useState } from "react";
// import {
//     Card,
//     CardHeader,
//     CardTitle,
//     CardContent,
// } from "@/components/ui/card";
// import { createChart, ISeriesApi, CandlestickData, CandlestickSeries } from "lightweight-charts";

// /**
//  * Very small utility types to model Binance stream payloads
//  */
// interface CandleStreamMessage {
//     e: string; // event type
//     E: number; // event time
//     s: string; // symbol
//     k: {
//         t: number; // start time
//         T: number; // close time
//         i: string; // interval
//         o: string; // open
//         c: string; // close
//         h: string; // high
//         l: string; // low
//         v: string; // volume
//         x: boolean; // is close?
//     };
// }

// interface DepthLevel {
//     price: number;
//     size: number;
// }

// const MAX_LEVELS = 18;

// export default function OrderBookDashboard() {
//     const chartContainerRef = useRef<HTMLDivElement | null>(null);
//     const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

//     const [bids, setBids] = useState<DepthLevel[]>([]);
//     const [asks, setAsks] = useState<DepthLevel[]>([]);

//     // ------ Candlestick Chart Setup ------ //
//     useEffect(() => {
//         if (!chartContainerRef.current) return;

//         const chart = createChart(chartContainerRef.current, {
//             width: chartContainerRef.current.clientWidth,
//             height: 500,
//             layout: {
//                 background: {  color: "#0f0f0f" },
//                 textColor: "#d1d5db", // Tailwind zinc-300
//             },
//             grid: {
//                 vertLines: { color: "#222" },
//                 horzLines: { color: "#222" },
//             },
//             timeScale: {
//                 timeVisible: true,
//                 secondsVisible: false,
//             },
//         });

//         const candleSeries = chart.addSeries(CandlestickSeries,{
//             upColor: "#16a34a",
//             downColor: "#dc2626",
//             borderVisible: false,
//             wickUpColor: "#16a34a",
//             wickDownColor: "#dc2626",
//         });
//         candleSeriesRef.current = candleSeries;

//         // fetch initial historical candles
//         fetch(
//             "https://api.binance.com/api/v3/klines?symbol=SOLUSDC&interval=1m&limit=500"
//         )
//             .then((res) => res.json())
//             .then((klines) => {
//                 const data: CandlestickData[] = klines.map((k: any) => ({
//                     time: k[0] / 1000,
//                     open: parseFloat(k[1]),
//                     high: parseFloat(k[2]),
//                     low: parseFloat(k[3]),
//                     close: parseFloat(k[4]),
//                 }));
//                 candleSeries.setData(data);
//             });

//         const ws = new WebSocket("wss://fstream.binance.com/ws/bnbusdt@aggTrade");
//         ws.onmessage = (event) => {
//             const msg: CandleStreamMessage = JSON.parse(event.data);
//             if (msg.e === "kline") {
//                 const k = msg.k;
//                 candleSeries.update({
//                     // @ts-ignore
//                     time: k.t / 1000,
//                     open: parseFloat(k.o),
//                     high: parseFloat(k.h),
//                     low: parseFloat(k.l),
//                     close: parseFloat(k.c),
//                 });
//             }
//         };

//         const handleResize = () => {
//             if (chartContainerRef.current) {
//                 chart.applyOptions({
//                     width: chartContainerRef.current.clientWidth,
//                 });
//             }
//         };
//         window.addEventListener("resize", handleResize);

//         return () => {
//             ws.close();
//             window.removeEventListener("resize", handleResize);
//             chart.remove();
//         };
//     }, []);

//     // ------ Orderbook (depth) setup ------ //
//     useEffect(() => {
//         const depthWs = new WebSocket(
//             "wss://stream.binance.com:9443/ws/solusdc@depth20@100ms"
//         );

//         depthWs.onmessage = (event) => {
//             const msg = JSON.parse(event.data);
//             const formatLevels = (levels: string[][]): DepthLevel[] =>
//                 levels
//                     .slice(0, MAX_LEVELS)
//                     .map(([p, s]) => ({ price: parseFloat(p), size: parseFloat(s) }));

//             setBids(formatLevels(msg.bids));
//             setAsks(formatLevels(msg.asks));
//         };

//         return () => depthWs.close();
//     }, []);

//     return (
//         <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4">
//             {/* Chart */}
//             <Card className="col-span-2">
//                 <CardHeader>
//                     <CardTitle>SOL / USDC – 1m</CardTitle>
//                 </CardHeader>
//                 <CardContent>
//                     <div ref={chartContainerRef} />
//                 </CardContent>
//             </Card>

//             {/* Orderbook */}
//             <Card>
//                 <CardHeader>
//                     <CardTitle>Order Book</CardTitle>
//                 </CardHeader>
//                 <CardContent>
//                     <div className="flex flex-col space-y-2 text-sm font-mono">
//                         {/* Asks */}
//                         {asks.map((lvl) => (
//                             <div key={`ask-${lvl.price}`} className="flex justify-between text-red-400">
//                                 <span>{lvl.price.toFixed(2)}</span>
//                                 <span>{lvl.size.toFixed(2)}</span>
//                             </div>
//                         ))}
//                         <hr className="my-2 opacity-40" />
//                         {/* Bids */}
//                         {bids.map((lvl) => (
//                             <div key={`bid-${lvl.price}`} className="flex justify-between text-green-400">
//                                 <span>{lvl.price.toFixed(2)}</span>
//                                 <span>{lvl.size.toFixed(2)}</span>
//                             </div>
//                         ))}
//                     </div>
//                 </CardContent>
//             </Card>
//         </div>
//     );
// }






"use client";



import { useEffect, useState } from "react";
import axios from "axios";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@repo/ui/components/card";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";

// Types shared with backend
interface DepthRow {
  price: number;
  qty: number;
}
interface DepthPayload {
  bids: DepthRow[];
  asks: DepthRow[];
}
interface TradeMsg {
  tradeId: string;
  side: "YES" | "NO";
  price: number;
  qty: number;
  taker: string;
  maker: string;
  ts: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8081";

export default function FrontEndTradeApp() {
  // ---------------- State ---------------- //
  const [depth, setDepth] = useState<DepthPayload>({ bids: [], asks: [] });
  const [trades, setTrades] = useState<TradeMsg[]>([]);

  // order ticket
  const [userId, setUserId] = useState("alice");
  const [side, setSide] = useState<"YES" | "NO">("YES");
  const [price, setPrice] = useState(7.5);
  const [qty, setQty] = useState(100);
  const [status, setStatus] = useState<string | null>(null);

  // ---------------- Effects ---------------- //
  // 1) load snapshot via REST
  useEffect(() => {
    axios.get<DepthPayload>(`${API_BASE}/api/v1/depth`).then((res) => setDepth(res.data));
  }, []);

  // 2) WS stream for depth & trades
  useEffect(() => {
    const ws = new WebSocket(WS_URL + "/ws");
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "depth") setDepth(msg.payload as DepthPayload);
      if (msg.type === "trade")
        setTrades((t) => [...msg.payload, ...t].slice(0, 30)); // keep last 30
    };
    return () => ws.close();
  }, []);

  // ---------------- Handlers ---------------- //
  const submitOrder = async () => {
    try {
      setStatus("Posting…");
      const res = await axios.post(`${API_BASE}/api/v1/orders`, {
        userId,
        side,
        price: Number(price),
        qty: Number(qty),
      });
      setStatus(`✅ Order ID ${res.data.orderId}`);
    } catch (e: any) {
      setStatus(`❌ ${e.response?.data?.error || "error"}`);
    }
  };

  // ---------------- UI ---------------- //
  return (
    <div className="grid lg:grid-cols-3 gap-4 p-4 font-mono bg-zinc-950 text-zinc-200 min-h-screen">
      {/* Order Book */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>Order Book</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-between space-x-4 text-xs">
          {/* Asks */}
          <div className="flex-1">
            {depth.asks.map((r) => (
              <div key={`ask-${r.price}`} className="flex justify-between text-red-400">
                <span>{r.price.toFixed(2)}</span>
                <span>{r.qty}</span>
              </div>
            ))}
          </div>
          {/* Bids */}
          <div className="flex-1">
            {depth.bids.map((r) => (
              <div key={`bid-${r.price}`} className="flex justify-between text-green-400">
                <span>{r.price.toFixed(2)}</span>
                <span>{r.qty}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Trade Tape */}
      <Card className="lg:col-span-1 overflow-y-auto max-h-[70vh]">
        <CardHeader>
          <CardTitle>Recent Trades</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-xs">
          {trades.map((t) => (
            <div key={t.tradeId} className="flex justify-between">
              <span className={t.side === "YES" ? "text-green-400" : "text-red-400"}>{t.side}</span>
              <span>{t.price.toFixed(2)}</span>
              <span>{t.qty}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Order Ticket */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>Place Order</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <label className="block mb-1">User ID</label>
            <Input value={userId} onChange={(e) => setUserId(e.target.value)} />
          </div>
          <div className="flex space-x-2 items-end">
            <div className="flex-1">
              <label className="block mb-1">Side</label>
              <select
                className="w-full bg-zinc-800 p-2 rounded"
                value={side}
                onChange={(e) => setSide(e.target.value as "YES" | "NO")}
              >
                <option value="YES">YES (Buy)</option>
                <option value="NO">NO (Sell)</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block mb-1">Price (₹)</label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="10"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
              />
            </div>
            <div className="flex-1">
              <label className="block mb-1">Qty</label>
              <Input
                type="number"
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
              />
            </div>
          </div>
          <Button className="w-full" onClick={submitOrder}>
            Submit
          </Button>
          {status && <p className="text-xs mt-2">{status}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
