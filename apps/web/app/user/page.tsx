'use client';

import { useCallback, useEffect, useState } from 'react';
import { OrderSide, OrderStatus } from "@repo/db"
import { z } from 'zod';

import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@repo/ui/components/card';
import { Badge } from '@repo/ui/components/badge';
import { Button } from '@repo/ui/components/button';
import { Input } from '@repo/ui/components/input';
import { withProtectedRoute } from '../context/withProtectedRoute';
import { Skeleton } from '@repo/ui/components/skeleton';
import { BadgeCheckIcon } from 'lucide-react';
import useBalance from '../hooks/useBalance';
import apiClient from '../lib/api-client';
import { useAuthStore } from '../store/useAuthStore';
import { useShallow } from 'zustand/react/shallow';
interface TradeMsg {
    id: string;
    side: OrderSide;
    pricePaise: string;
    price: number;
    decimal: number;
    qty: number;
    createdAt: string;
    event: EventLite;
}
interface EventLite { id: string; title: string; status: OrderStatus }

interface OrderInMem {
    id: string;
    side: OrderSide;
    pricePaise: string;
    price: number;
    decimal: number;
    qty: number;
    openQty: number;
    status: OrderStatus;
    event: EventLite;
}

const amountSchema = z.number().int().min(10).max(10_000);

const QUICK = [100, 500, 1_000] as const;
function UserWalletCard() {
    const { balance, refreshBalance } = useBalance()
    const [custom, setCustom] = useState('');
    const [msg, setMsg] = useState('');
    const [orders, setOrders] = useState<OrderInMem[]>([]);
    const [trades, setTrades] = useState<TradeMsg[]>([]);
    const [loading, setLoading] = useState<boolean>(true)
    const { isAuthenticated } = useAuthStore(useShallow((state) => ({
        isAuthenticated: state.isAuthenticated,
    })))

    const refreshAll = useCallback(async () => {
        if (!isAuthenticated) {
            setLoading(false)
            return
        }
        try {
            const [ord, trd] = await Promise.all([
                apiClient.get<OrderInMem[]>(`/me/orders?status=OPEN`),
                apiClient.get<TradeMsg[]>(`/me/trades`),
            ]);
            setOrders(ord.data);
            setTrades(trd.data.slice(0, 20));
            setLoading(false)
        } catch {

            setMsg('could not fetch data');
            setLoading(false)
        }
    }, [isAuthenticated])


    useEffect(() => { if (isAuthenticated) { refreshAll(); } }, [isAuthenticated, refreshAll]);



    async function topUp(amount: number) {
        if (!isAuthenticated) { setMsg('please sign in again'); return; }
        setMsg('processing...');
        try {
            await apiClient.post(`/wallet/topup`, {
                amt: amount
            })

            setMsg('Balance updated');
            setCustom('');
            refreshBalance();
        } catch (e: any) {
            setMsg(e.response?.data?.error || 'server error');
        }
    }

    const rup = (p: number, decimal = 2) => p.toFixed(Math.min(decimal, 2));

    function StatusBadge({ s }: { s: OrderStatus }) {
        const clr =
            s === 'OPEN' ? 'bg-yellow-600/20 text-yellow-400' :
                s === 'FILLED' ? 'bg-emerald-600/20 text-emerald-400' :
                    s === 'CANCELLED' ? 'bg-zinc-600/20 text-zinc-400' :
                        s === 'SETTLED' ? 'bg-indigo-600/20 text-indigo-400' :
                            'bg-zinc-700';
        return <span className={`px-1 rounded  ${clr}`}>{s}</span>;
    }

    function submitCustom() {
        const amt = Number(custom);
        const valid = amountSchema.safeParse(amt);
        if (!valid.success) {
            setMsg('enter amount between 10 and 10,000');
            return;
        }
        topUp(amt);
    }

    if (loading) {
        return (
            <div className='px-6 bg-zinc-950 min-h-screen py-24 grid lg:grid-cols-3 gap-4 '>

                {/* <div className='col-span-2 flex flex-col'>

                </div> */}
                <Skeleton className="bg-zinc-500 lg:col-span-1 col-span-3 mb-2 rounded-xl" />
                <Skeleton className="lg:col-span-2 rounded-xl col-span-3 bg-zinc-500 mb-2 " />
                <Skeleton className="lg:col-span-3 rounded-xl col-span-3 bg-zinc-500  " />

            </div>
        )
    }

    return (
        <div className="px-6 py-24 lg:grid lg:grid-cols-3 gap-4  space-y-6 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-800 min-h-screen w-full text-white">

            <div className="absolute -top-40 -left-40 w-80 h-80 bg-indigo-500 rounded-full blur-3xl opacity-30 animate-pulse" />
            <div className="absolute lg:-bottom-6 lg:-right-32 -bottom-40 -right-0 w-[12rem] h-[12rem] bg-fuchsia-500 rounded-full blur-3xl opacity-20 animate-pulse" />

            <Card className="col-span-1">
                <CardHeader><CardTitle className="text-xl">Wallet</CardTitle></CardHeader>

                <CardContent className="space-y-6">

                    <div className="text-4xl font-extrabold text-emerald-400">
                        {balance === null ? '₹ --' : `₹${balance.toFixed(2)}`}
                    </div>


                    <div className="flex gap-3">
                        {QUICK.map((v, i) => (
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
                    <CardContent className='h-40 overflow-y-auto'>
                        <table className="w-full  text-sm ">
                            <thead className=" text-zinc-400">
                                <tr>
                                    <th className="p-2 text-left min-w-[200px]"> Title</th>
                                    <th className="p-2 text-left">Bid</th>
                                    <th className="p-2 text-left">Price</th>
                                    <th className="p-2 text-left">Qty</th>
                                    <th className="p-2 text-left">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800 ">
                                {orders.length === 0 ? (
                                    <tr className="border-t border-zinc-700">
                                        <td className="text-center text-zinc-500 p-4">
                                            no open orders
                                        </td>
                                    </tr>
                                ) : (
                                    orders.map((o) => (
                                        <tr key={o.id} className="border-t border-zinc-700">
                                            <td className="p-2 min-w-[200px]" >{o.event.title} </td>
                                            <td >
                                                <Badge
                                                    variant="destructive"
                                                    className={` ${o.side === 'YES' ? 'bg-green-600' : 'bg-red-600'}`}
                                                >
                                                    {/* <BadgeCheckIcon /> */}
                                                    {o.side}
                                                </Badge>
                                            </td>
                                            <td className="p-2">₹{rup(o.price, o.decimal)}</td>
                                            <td className="p-2">{o.openQty}</td>
                                            <td className="p-2">  <Badge variant="secondary">{o.status}</Badge> </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>

                    </CardContent>
                </CardHeader>
            </Card>
            <Card className='font-semibold  col-span-3'>
                <CardHeader>
                    <CardTitle>
                        My Trades
                    </CardTitle>
                    <CardContent className='overflow-y-auto'>
                        <table className="w-full text-sm">
                            <thead className="text-zinc-400">
                                <tr>
                                    <th className="p-2 text-left min-w-[200px]">Title</th>
                                    <th className="p-2 text-left">Bid</th>
                                    <th className="p-2 text-left">Price</th>
                                    <th className="p-2 text-left">Qty</th>
                                    <th className="p-2 text-left">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800 h-40 overflow-y-auto overflow-x-auto">
                                {trades.length === 0 ? (
                                    <tr className="border-t border-zinc-700">
                                        <td colSpan={5} className="text-center text-zinc-500 p-4">
                                            no trades yet
                                        </td>
                                    </tr>
                                ) : (
                                    trades.map(t => (
                                        <tr key={t.id} className="border-t border-zinc-700">
                                            <td className="p-2 min-w-[200px]">{t.event.title}</td>

                                            <td >

                                                <Badge
                                                    variant="destructive"
                                                    className={` ${t.side === 'YES' ? 'bg-green-600' : 'bg-red-600'}`}
                                                >
                                                    <BadgeCheckIcon size={18} />
                                                    {t.side}
                                                </Badge>
                                            </td>

                                            <td className="p-2">₹{rup(t.price, t.decimal)}</td>
                                            <td className="p-2">{t.qty}</td>
                                            <td className="p-2 text-xs text-zinc-400">{new Date(t.createdAt).toLocaleDateString()}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>

                    </CardContent>
                </CardHeader>
            </Card>
        </div>
    );
}
export default withProtectedRoute(UserWalletCard)
