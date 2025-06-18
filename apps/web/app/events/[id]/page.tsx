'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import axios from 'axios';
import {
    Card, CardHeader, CardTitle, CardContent,
    CardAction,
} from '@repo/ui/components/card';
import { Input } from '@repo/ui/components/input';
import { Button } from '@repo/ui/components/button';
import { withProtectedRoute } from '@/app/context/withProtectedRoute';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@repo/ui/components/select"
import {
    ToggleGroup,
    ToggleGroupItem,
} from "@repo/ui/components/toggle-group"
import DepthTable from '@/app/components/DepthTable';
import { Minus, Plus } from 'lucide-react';
import { Skeleton } from '@repo/ui/components/skeleton';
import { prisma, OrderSide, OrderStatus, Role, EventStatus } from "@repo/db"


interface DepthRow { price: number; qty: number; }
interface Depth { bids: DepthRow[]; asks: DepthRow[]; }
interface Trade { tradeId: string; side: OrderSide; price: number; qty: number; ts: number; }
interface EventMeta { id: string, title: string; endsAt: string; }

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const WSS = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8081';

function TradeDashboard() {
    const { id: eventId } = useParams<{ id: string }>();
    const token = typeof window !== 'undefined' ? localStorage.getItem('oddsCraftToken') : null;
    const [marketYes, setMarketYes] = useState<number | null>(null);

    const [depth, setDepth] = useState<Depth>({ bids: [], asks: [] });
    const [trades, setTrades] = useState<Trade[]>([]);
    const [event, setEvent] = useState<EventMeta | null | undefined>(null);


    const [side, setSide] = useState<OrderSide>('YES');
    const [price, setPrice] = useState(7.5);
    const [qty, setQty] = useState(100);
    const [msg, setMsg] = useState('');


    useEffect(() => {
        if (!token || !eventId) return;

        async function fetchInitial() {
            try {
                const headers = { Authorization: `Bearer ${token}` };
                const [meta, book] = await Promise.all([
                    axios.get<EventMeta[]>(`${API}/api/v1/events?id=${eventId}`, { headers }),
                    axios.get<Depth>(`${API}/api/v1/depth?eventId=${eventId}`, { headers }),
                ]);
                console.log("meta", meta);
                console.log("meta2", book);
                if (meta.data.length > 0) {

                    setEvent(meta.data[0]);
                }
                setDepth(book.data);
            } catch (err: any) {
                setMsg(err.response?.data?.error || 'server');
            }
        }

        fetchInitial();
    }, [token, eventId]);


    useEffect(() => {
        if (!token || !eventId) return;

        const ws = new WebSocket(`${WSS}?token=${token}&eventId=${eventId}`);

        ws.onmessage = (e) => {
            const m = JSON.parse(e.data);
            if (m.type === 'depth') setDepth(m.payload);
            if (m.type === 'trade') setTrades((t) => [...m.payload, ...t].slice(0, 40));
            const last = m?.payload[0]!
            if (!last) return
            const yesPrice = last.side === 'YES'
                ? last.price
                : 10 - last.price;
            setMarketYes(yesPrice);
        };

        return () => ws.close();
    }, [token, eventId]);

    useEffect(() => {

        if (!depth || !depth.bids.length || !depth.asks.length) return;


        const bestBidYes = depth.bids[0]?.price || 0;
        const bestAskNo = depth.asks[0]?.price || 0;
        const midYes = (bestBidYes + (10 - bestAskNo)) / 2;

        if (marketYes === null) setMarketYes(midYes);
    }, [depth]);

    async function place() {
        setMsg('posting…');
        try {
            const headers = { Authorization: `Bearer ${token}` };
            await axios.post(`${API}/api/v1/orders`,
                { eventId, side, price: +price, qty: +qty },
                { headers }
            );
            setMsg('✅ placed');
        } catch (err: any) {
            setMsg(`❌ ${err.response?.data?.error || 'server'}`);
        }
    }


    return (
        <div className="grid lg:grid-cols-3 gap-4 py-24 min-h-screen bg-zinc-950 text-zinc-200 font-mono">
            <div className="absolute -top-40 -left-40 w-80 h-80 bg-indigo-500 rounded-full blur-3xl opacity-30 animate-pulse"></div>
            <div className="absolute -bottom-1 -right-32 w-[12rem] h-[12rem] bg-fuchsia-500 rounded-full blur-3xl opacity-20 animate-pulse"></div>
            <div className='col-span-2 flex flex-col'>
                <Card className='p-2 bg-[#171717] h-[20%] mb-2'>
                <CardHeader>
                    <CardTitle className='text-2xl'>
                        {event ? event.title : <Skeleton className="h-[40px] w-full rounded-full bg-zinc-500" />
                        }
                        {/* <span className="block text-xs font-normal text-zinc-400">
                            Ends {event ? new Date(event.endsAt).toLocaleString() : '—'}
                        </span> */}
                    </CardTitle>
                </CardHeader>
             
            </Card>
                <Card className='p-2 bg-[#171717] h-full mt-1'>
                
                <CardContent className="flex justify-between text-xs p-2">
                    <div className="flex-1 mr-2">
                        <div className="flex justify-between">
                            <span className='text-lg'>Price</span>
                            <span className='text-lg'>Qty(Yes)</span>
                        </div>
                        {depth.asks.map((r) => (
                            <div key={`ask-${r.price}`} className="flex justify-between text-green-400">
                                <span>{(10 - r.price).toFixed(1)}</span><span>{r.qty}</span>
                            </div>
                        ))}
                    </div>
                    <div className="flex-1 ml-2">
                        <div className="flex justify-between">
                            <span className='text-lg'>Price</span>
                            <span className='text-lg'>Qty(No)</span>
                        </div>

                        {depth.bids.map((r) => (
                            <div key={`bid-${r.price}`} className="flex justify-between text-red-400">
                                <span>{(10 - r.price).toFixed(1)}</span>
                                <span>{r.qty}</span>
                            </div>
                        ))}
                    </div>
                    {/* <DepthTable bids={depth.bids} asks={depth.asks} /> */}
                </CardContent>
            </Card>
            </div>

            {/* <Card className="overflow-y-auto max-h-[70vh] p-2 bg-[#171717]">
                <CardHeader><CardTitle>Trades</CardTitle></CardHeader>
                <CardContent className="space-y-1 text-xs">
                    {trades.map((t) => (
                        <div key={t.tradeId} className="flex justify-between">
                            <span className={t.side === 'YES' ? 'text-green-400' : 'text-red-400'}>{t.side}</span>
                            <span>{t.price.toFixed(1)}</span><span>{t.qty}</span>
                        </div>
                    ))}
                </CardContent>
            </Card> */}

            <Card className='p-2 bg-[#171717] col col-span-1 sticky top-24'>
                <CardHeader><CardTitle>New Order</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                    <CardAction>
                        <ToggleGroup
                            type="single"
                            defaultValue="YES"
                            value={side}
                            onValueChange={(val: string) => { if (val) setSide(val as OrderSide); }}
                            variant="outline"
                            className="@[767px]/card:flex"
                            
                        >
                      
                      
                            <ToggleGroupItem value='YES' className="rounded-full m-1 data-[state=on]:bg-white data-[state=on]:text-black ">YES</ToggleGroupItem>
                            <ToggleGroupItem value="NO" className="rounded-full m-1 data-[state=on]:bg-white data-[state=on]:text-black">NO</ToggleGroupItem>

                        </ToggleGroup>
                        {/* <Select value={side} onValueChange={(val: string) => setSide(val as OrderSide)}>
                            <SelectTrigger className="w-[280px]">
                                <SelectValue placeholder="Yes" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="YES" className="rounded-lg">
                                    Yes
                                </SelectItem>
                                <SelectItem value="NO" className="rounded-lg">
                                    No
                                </SelectItem>

                            </SelectContent>
                        </Select> */}
                    </CardAction>
                    <div >
                        {/* <select value={side} onChange={(e) => setSide(e.target.value as any)}
                            className="bg-zinc-800 rounded px-2 flex-1">
                            <option value="YES">YES</option>
                            <option value="NO">NO</option>
                        </select> */}
                       
                        <div className="flex items-center justify-between">

                            <span className='mt-4 flex items-center justify-between'>Price</span>
                            <div className="mt-4 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => setPrice((prev) => Math.max(0.1, prev - 0.5))}
                                        className="text-black"
                                        disabled={price <= 0.1}
                                    >
                                        <Minus className="h-4 w-4" />
                                    </Button>

                                    <Input
                                        min={0.1}
                                        max={9.9}
                                        step="0.1"
                                        value={price.toFixed(1)}
                                        onChange={(e) => {
                                            const val = parseFloat(e.target.value);
                                            if (!isNaN(val) && val > 0 && val < 10) setPrice(val);
                                        }}
                                        className="flex-1 text-black w-16 text-center"
                                    />

                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => setPrice((prev) => Math.max(9.9, prev + 0.5))}
                                        className="text-black"
                                        disabled={price >= 9.9}
                                    >
                                        <Plus className="h-4 w-4" />
                                    </Button>

                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-between">


                            <span className='mt-4 flex items-center justify-between'>Quantity</span>
                            <div className="mt-4 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        disabled={qty <= 1}
                                        onClick={() => setQty((prev) => Math.max(1, prev - 1))}
                                        className="text-black"
                                    >
                                        <Minus className="h-4 w-4" />
                                    </Button>

                                    <Input

                                        step="1"
                                        min="1"
                                        max="500"
                                        value={qty}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value, 10);
                                            if (!isNaN(val) && val >= 0 && val <= 500) {
                                                setQty(val);
                                            }
                                        }}
                                        className="flex-1 text-black w-16 text-center"
                                    />

                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => setQty((prev) => Math.min(500, prev + 1))}

                                        className="text-black"
                                        disabled={qty >= 500}
                                    >
                                        <Plus className="h-4 w-4" />
                                    </Button>

                                </div>
                            </div>

                        </div>
                    </div>
                    <Button className="w-full" onClick={place}>Submit</Button>
                    {marketYes !== null && (
                        <div className="mt-1 text-sm font-medium text-zinc-400">
                            Market&nbsp;
                            <span className="text-green-400">YES ₹{marketYes.toFixed(1)}</span>
                            &nbsp;/&nbsp;
                            <span className="text-red-400">NO ₹{(10 - marketYes).toFixed(1)}</span>
                        </div>
                    )}
                    {msg && <p className="text-xs">{msg}</p>}
                </CardContent>
            </Card>
        </div>
    );
}

export default withProtectedRoute(TradeDashboard);
