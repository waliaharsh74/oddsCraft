'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
    Card, CardHeader, CardTitle, CardContent,
    CardAction,
} from '@repo/ui/components/card';
import { Input } from '@repo/ui/components/input';
import { Button } from '@repo/ui/components/button';
import { withProtectedRoute } from '@/app/context/withProtectedRoute';
import {
    ToggleGroup,
    ToggleGroupItem,
} from '@repo/ui/components/toggle-group';
import { Minus, Plus } from 'lucide-react';
import { Skeleton } from '@repo/ui/components/skeleton';
import { OrderSide } from '@repo/db';
import apiClient from '@/app/lib/api-client';
import { getCookie, CLIENT_AUTH_COOKIE } from '@/app/lib/cookies';
import { WS_BACKEND_URL } from '@/app/config';

interface DepthRow { price: number; qty: number; }
interface Depth { bids: DepthRow[]; asks: DepthRow[]; }
interface Trade { tradeId: string; side: OrderSide; price: number; qty: number; ts: number; }
interface EventMeta { id: string; title: string; endsAt: string; }

const WSS = WS_BACKEND_URL;

function TradeDashboard() {
    const { id: eventId } = useParams<{ id: string }>();
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [marketYes, setMarketYes] = useState<number | null>(null);

    const [depth, setDepth] = useState<Depth>({ bids: [], asks: [] });
    const [event, setEvent] = useState<EventMeta | null | undefined>(null);
    const [loading, setLoading] = useState(true);

    const [side, setSide] = useState<OrderSide>('YES');
    const [price, setPrice] = useState(7.5);
    const [qty, setQty] = useState(100);
    const [msg, setMsg] = useState('');

    useEffect(() => {
        const syncToken = () => setAccessToken(getCookie(CLIENT_AUTH_COOKIE));
        syncToken();
        window.addEventListener("focus", syncToken);
        return () => window.removeEventListener("focus", syncToken);
    }, []);

    useEffect(() => {
        if (!eventId) return;

        async function fetchInitial() {
            try {
                const [meta, book] = await Promise.all([
                    apiClient.get<EventMeta[]>(`/api/v1/events?id=${eventId}`),
                    apiClient.get<Depth>(`/api/v1/depth?eventId=${eventId}`),
                ]);
                if (meta.data.length > 0) {
                    setEvent(meta.data[0]);
                }
                setDepth(book.data);
            } catch (err: any) {
                setMsg(err?.response?.data?.error || 'server');
            } finally {
                setLoading(false);
            }
        }

        fetchInitial();
    }, [eventId]);

    useEffect(() => {
        if (!accessToken || !eventId) return;

        const ws = new WebSocket(`${WSS}?token=${accessToken}&eventId=${eventId}`);

        ws.onmessage = (e) => {
            const m = JSON.parse(e.data);
            if (m.type === 'depth') setDepth(m.payload);
            if (m.type === 'trade') {
                const trades = (m.payload as Trade[]) || [];
                const [last] = trades;
                if (!last) return;
                const yesPrice = last.side === 'YES'
                    ? last.price
                    : 10 - last.price;
                setMarketYes(yesPrice);
            }
        };

        return () => ws.close();
    }, [accessToken, eventId]);

    useEffect(() => {
        if (!depth || !depth.bids.length || !depth.asks.length) return;

        const bestBidYes = depth.bids[0]?.price || 0;
        const bestAskNo = depth.asks[0]?.price || 0;
        const midYes = (bestBidYes + (10 - bestAskNo)) / 2;

        if (marketYes === null) setMarketYes(midYes);
    }, [depth, marketYes]);

    async function place() {
        if (!eventId) return;
        setMsg('posting...');
        try {
            await apiClient.post("/api/v1/orders",
                { eventId, side, price: +price, qty: +qty },
            );
            setMsg('Order placed');
        } catch (err: any) {
            setMsg(`Error: ${err?.response?.data?.error || 'server'}`);
        }
    }

    if (loading) {
        return (
            <div className='px-6 bg-zinc-950 min-h-screen py-24 grid lg:grid-cols-3 gap-4 '>

                <div className='col-span-2 flex flex-col'>

                    <Skeleton className=" bg-zinc-500 h-[20%] mb-2" />
                    <Skeleton className="col-span-2  rounded-xl bg-zinc-500  h-full mt-1" />
                </div>
                <Skeleton className="p-2  col col-span-1 rounded-xl bg-zinc-500  sticky top-24" />

            </div>
        )
    }

    return (
        <div className="px-6 flex flex-col gap-8 lg:grid lg:grid-cols-3 lg:gap-4 py-24 min-h-screen bg-zinc-950 text-zinc-200 font-mono">
            <div className="absolute -top-40 -left-40 w-80 h-80 bg-indigo-500 rounded-full blur-3xl opacity-30 animate-pulse"></div>
            <div className="absolute lg:-bottom-0 lg:-right-32 bottom-2 right-2 w-[12rem] h-[12rem] bg-fuchsia-500 rounded-full blur-3xl opacity-20 animate-pulse" />
            <div className='col-span-2 flex flex-col gap-4'>
                <Card className='p-2 bg-[#171717] h-[20%] mb-2'>
                    <CardHeader>
                        <CardTitle className='text-2xl'>
                            {event ? event.title : <Skeleton className="h-[40px] w-full rounded-full bg-zinc-500" />
                            }
                        </CardTitle>
                    </CardHeader>

                </Card>
                <Card className='p-2 bg-[#171717] lg:h-full mt-1 h-[200px] overflow-y-auto '>

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
                    </CardContent>
                </Card>
            </div>

            <Card className='p-2 bg-[#171717] col col-span-1 sticky top-24 min-h-[350px]'>
                <CardHeader><CardTitle className='text-xl'>New Order</CardTitle></CardHeader>
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
                    </CardAction>
                    <div >
                        <div className="flex items-center justify-between">

                            <span className='mt-4 flex items-center justify-between'>Price</span>
                            <div className="mt-4 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => setPrice((prev) => Math.max(0.1, prev - 0.1))}
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
                                        onClick={() => setPrice((prev) => Math.min(9.9, prev + 0.1))}
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
