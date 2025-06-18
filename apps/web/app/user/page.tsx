'use client';

import { useEffect, useMemo, useState } from 'react';
import { prisma, OrderSide, OrderStatus, Role, EventStatus } from "@repo/db"
import { z } from 'zod';

import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@repo/ui/components/card';
import { Button } from '@repo/ui/components/button';
import { Input } from '@repo/ui/components/input';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { withProtectedRoute } from '../context/withProtectedRoute';
interface TradeMsg {
    id: string; side: OrderSide; pricePaise: number; qty: number; createdAt: string; event: EventLite; 
  }
interface EventLite { id: string; title: string; status: OrderStatus }

interface OrderInMem {
    id: string;
    side: OrderSide;
    pricePaise: number;
    qty: number;
    openQty: number;
    status: OrderStatus;
    event: EventLite;  
  }

const amountSchema = z.number().int().min(10).max(10_000);

const QUICK = [100, 500, 1_000] as const;
function UserWalletCard() {
    const [balance, setBalance] = useState<number | null>(null);
    const [custom, setCustom] = useState('');
    const [msg, setMsg] = useState('');
    const [token, setToken] = useState<string | null>(null);
    const [orders, setOrders] = useState<OrderInMem[]>([]);
    const [trades, setTrades] = useState<TradeMsg[]>([]);
    const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const headers = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

    async function refreshAll() {
        try {
            const [bal, ord, trd] = await Promise.all([
                axios.get<{ balance: number }>(`${API}/api/v1/me/balance`, headers),
                axios.get<OrderInMem[]>(`${API}/api/v1/me/orders?status=OPEN`, headers),
                axios.get<TradeMsg[]>(`${API}/api/v1/me/trades`, headers),
            ]);
            setBalance(bal.data.balance);
            setOrders(ord.data);
            setTrades(trd.data.slice(0, 20));
        } catch { setMsg('⚠︎ could not fetch data'); }
    }


    useEffect(() => { setToken(localStorage.getItem('oddsCraftToken')); }, []);
    useEffect(() => { if (token) refreshAll(); }, [token]);

 
  
    async function topUp(amount: number) {
        setMsg('processing…');
        try {
            await axios.post(`${API}/api/v1/wallet/topup`,{
                amt:amount
            }, headers)
      
            setBalance(b => (b ?? 0) + amount);
            setMsg('✅ balance updated');
            setCustom('');
        } catch (e: any) {
            setMsg(e.response?.data?.error || 'server error');
        }
    }
   
    const rup = (p: number) => (p / 100).toFixed(1);

    function StatusBadge({ s }: { s: OrderStatus }) {
        const clr =
            s === 'OPEN' ? 'bg-yellow-600/20 text-yellow-400' :
                s === 'FILLED' ? 'bg-emerald-600/20 text-emerald-400' :
                    s === 'CANCELLED' ? 'bg-zinc-600/20 text-zinc-400' :
                        s === 'SETTLED' ? 'bg-indigo-600/20 text-indigo-400' :
                            'bg-zinc-700';
        return <span className={`px-1 rounded text-[10px] ${clr}`}>{s}</span>;
    }

    function submitCustom() {
        const amt = Number(custom);
        const valid = amountSchema.safeParse(amt);
        if (!valid.success) {
            setMsg('enter amount between 10 – 10 000');
            return;
        }
        topUp(amt);
    }

    return (
        <div className="px-6 py-32 grid lg:grid-cols-3 gap-4  space-y-6 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-800 min-h-screen text-white">
            
            <div className="absolute -top-40 -left-40 w-80 h-80 bg-indigo-500 rounded-full blur-3xl opacity-30 animate-pulse" />
            <div className="absolute -bottom-6 -right-32 w-[12rem] h-[12rem] bg-fuchsia-500 rounded-full blur-3xl opacity-20 animate-pulse" />

            <Card className="col-span-1">
                <CardHeader><CardTitle className="text-xl">Wallet</CardTitle></CardHeader>

                <CardContent className="space-y-6">
                    
                    <div className="text-4xl font-extrabold text-emerald-400">
                        {balance === null ? '—' : `₹${balance.toFixed(2)}`}
                    </div>

                
                    <div className="flex gap-3">
                        {QUICK.map((v,i) => (
                            <Button key={i} variant="outline" className="flex-1 text-black" onClick={() => topUp(v)}>
                                +₹{v}
                            </Button>
                        ))}
                    </div>

                
                    <div className="flex gap-2">
                        <Input placeholder="custom" type="number" value={custom}
                            onChange={e => setCustom(e.target.value)} className="flex-1 text-black" />
                        <Button onClick={submitCustom}>Add</Button>
                    </div>

                    {msg && <p className="text-xs text-zinc-400">{msg}</p>}


                </CardContent>

                <CardFooter className="text-xs text-zinc-500">Funds are demo rupees. Top-ups are instant.</CardFooter>
            </Card>
            <Card className='font-semibold  col-span-2'>
                <CardHeader>
                    <CardTitle>
                        My Orders
                    </CardTitle>
                    <CardContent>
                        <div className="h-40 overflow-y-auto border border-zinc-700/40 rounded p-1 ">
                            {orders.length === 0 && <p className="text-zinc-500">no open orders</p>}
                            {orders.map(o => (
                                <div key={o.id} className="flex flex-col border-b border-zinc-800 pb-1 last:border-none">
                                    <div className="flex justify-between">
                                        <span className={o.side === 'YES' ? 'text-green-400' : 'text-red-400'}>
                                            {o.side} ₹{rup(o.pricePaise)}
                                        </span>
                                        <span>{o.openQty}</span>
                                    </div>
                                    <div className="flex justify-between text-[10px] text-zinc-400">
                                        <span>{o.event.title}</span>
                                        <StatusBadge s={o.status} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </CardHeader>
            </Card>
            <Card className='font-semibold  col-span-3'>
                <CardHeader>
                    <CardTitle>
                        My Trades
                    </CardTitle>
                    <CardContent>
                        <div className="pt-6">
                          
                            <div className="h-40 overflow-y-auto border border-zinc-700/40 rounded p-1 ">
                                {trades.length === 0 && <p className="text-zinc-500">no trades yet</p>}
                                {trades.map(t => (
                                    <div key={t.id} className="flex flex-col border-b border-zinc-800 pb-1 last:border-none">
                                        <div className="flex justify-between">
                                            <span className={t.side === 'YES' ? 'text-green-400' : 'text-red-400'}>
                                                {t.side}
                                            </span>
                                            <span>{t.qty}@{rup(t.pricePaise)}</span>
                                        </div>
                                        <div className="flex justify-between text-[10px] text-zinc-400">
                                            <span>{t.event.title}</span>
                                            <span>{new Date(t.createdAt).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                        </div>
                    </CardContent>
                </CardHeader>
            </Card>
        </div>
    );
}
export default withProtectedRoute(UserWalletCard)
