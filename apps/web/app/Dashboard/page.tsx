'use client';

import { useContext, useEffect, useState } from "react";

import { withProtectedRoute } from '@/app/context/withProtectedRoute'
import {
    Card, CardHeader, CardTitle, CardContent,
} from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { Button } from "@repo/ui/components/button";

interface DepthRow { price: number; qty: number; }
interface Depth { bids: DepthRow[]; asks: DepthRow[]; }
interface Trade { tradeId: string; side: "YES" | "NO"; price: number; qty: number; ts: number; }
import { AuthContext } from "../context/AuthContext";
import axios from "axios";


const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8081";

function TradeDashboard() {
     const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

    const api = axios.create({ baseURL: `${API_BASE}/api/v1` });

     function setToken() {
        const context = useContext(AuthContext);
        if (!context) {
            return null;
        }
        const { userToken } = context;
        const token = userToken
        if (token) {
            
            api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
        } else {
            
            
            delete api.defaults.headers.common["Authorization"];
        }
    }

    setToken();
   
    const [depth, setDepth] = useState<Depth>({ bids: [], asks: [] });
    const [trades, setTrades] = useState<Trade[]>([]);
    const [price, setPrice] = useState(7.5);
    const [qty, setQty] = useState(100);
    const [side, setSide] = useState<"YES" | "NO">("YES");
    const [msg, setMsg] = useState("");
    const context = useContext(AuthContext);
    if (!context) {
        return null;
    }
    const { userToken } = context; 

   
    useEffect(() => { api.get("/depth").then(r => setDepth(r.data)); }, []);


    useEffect(() => {
        const token = userToken;
        const ws = new WebSocket(`${WS_URL}?token=${token}`);
        ws.onmessage = e => {
            const m = JSON.parse(e.data);
            if (m.type === "depth") setDepth(m.payload);
            if (m.type === "trade") setTrades(t => [...m.payload, ...t].slice(0, 40));
        };
        return () => ws.close();
    }, []);

    async function place() {
        setMsg("posting…");
        try {
            await api.post("/orders", { side, price: Number(price), qty: Number(qty) });
            setMsg("✅ placed");
        } catch (e: any) {
            setMsg(`❌ ${e.response?.data?.error || "err"}`);
        }
    }

    return (
        <div className="grid lg:grid-cols-3 gap-4 py-24 min-h-screen bg-zinc-950 text-zinc-200 font-mono">

            <Card><CardHeader><CardTitle>Order Book</CardTitle></CardHeader>
                <CardContent className="flex justify-between text-xs">
                    <div className="flex-1">
                        {depth.asks.map(r => (
                            <div key={`ask-${r.price}`} className="flex justify-between text-red-400">
                                <span>{r.price.toFixed(1)}</span><span>{r.qty}</span>
                            </div>))}
                    </div>
                    <div className="flex-1">
                        {depth.bids.map(r => (
                            <div key={`bid-${r.price}`} className="flex justify-between text-green-400">
                                <span>{r.price.toFixed(1)}</span><span>{r.qty}</span>
                            </div>))}
                    </div>
                </CardContent>
            </Card>

         
            <Card className="overflow-y-auto max-h-[70vh]"><CardHeader><CardTitle>Trades</CardTitle></CardHeader>
                <CardContent className="space-y-1 text-xs">
                    {trades.map(t => (
                        <div key={t.tradeId} className="flex justify-between">
                            <span className={t.side === "YES" ? "text-green-400" : "text-red-400"}>{t.side}</span>
                            <span>{t.price.toFixed(1)}</span><span>{t.qty}</span>
                        </div>
                    ))}
                </CardContent>
            </Card>

      
            <Card><CardHeader><CardTitle>New Order</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex space-x-2 items-end">
                        <select value={side} onChange={e => setSide(e.target.value as any)}
                            className="bg-zinc-800 rounded px-2 flex-1">
                            <option value="YES">YES</option><option value="NO">NO</option>
                        </select>
                        <Input type="number" step="0.1" min="0.1" max="9.9"
                            value={price} onChange={e => setPrice(+e.target.value)} className="flex-1" />
                        <Input type="number" value={qty}
                            onChange={e => setQty(+e.target.value)} className="flex-1" />
                    </div>
                    <Button className="w-full" onClick={place}>Submit</Button>
                    {msg && <p className="text-xs">{msg}</p>}
                </CardContent>
            </Card>
        </div>
    );
}
export default withProtectedRoute(TradeDashboard)
