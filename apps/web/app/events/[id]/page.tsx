'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@repo/ui/components/card';
import { Input } from '@repo/ui/components/input';
import { Button } from '@repo/ui/components/button';
import { Skeleton } from '@repo/ui/components/skeleton';
import { withProtectedRoute } from '@/app/context/withProtectedRoute';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@repo/ui/components/toggle-group';
import { Minus, Plus, X } from 'lucide-react';
import { OrderSide } from '@repo/db';
import apiClient from '@/app/lib/api-client';
import { WS_BACKEND_URL } from '@/app/config';
import useBalance from '@/app/hooks/useBalance';
import { toast, ToastContainer } from 'react-toastify';



interface DepthRow {
  price: number; 
  qty: number;
}
interface Depth {
  bids: DepthRow[];
  asks: DepthRow[];
}
interface Trade {
  tradeId: string;
  side: OrderSide;
  price: number;
  qty: number;
  ts: number;
}
interface EventMeta {
  id: string;
  title: string;
  endsAt: string;
  description?: string;
  resolutionSource?: string;
}

const WSS = WS_BACKEND_URL;

const ORDER_TYPES = ['LIMIT', 'MARKET'] as const;
type OrderType = (typeof ORDER_TYPES)[number];

const INTENTS = ['TRADE', 'LIQUIDITY'] as const;
type Intent = (typeof INTENTS)[number];

const LIQ_PRICE = 10.0;
const TICK_SIZE = 0.1;
const FACE_MIN = 0.0 + TICK_SIZE;
const FACE_MAX = 10.0 - TICK_SIZE;
const MAX_QTY = 100;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function roundToTick(raw: number) {
  return Math.round(raw / TICK_SIZE) * TICK_SIZE;
}

function isOffTick(raw: number) {
  return Math.abs(roundToTick(raw) - raw) > 1e-9;
}

function normalizePrice(raw: number) {
  const snapped = clamp(roundToTick(raw), FACE_MIN, FACE_MAX);
  return Number(snapped.toFixed(1));
}

function assertOrderValid(price10: number, qty: number) {
  if (qty <= 0 || !Number.isFinite(qty)) throw new Error('bad_qty');
  if (qty > MAX_QTY) throw new Error('bad_max_qty');
  const norm = roundToTick(price10);
  if (Math.abs(norm - price10) > 1e-9) throw new Error('bad_tick');
  if (norm < FACE_MIN || norm > FACE_MAX) throw new Error('bad_price');
}

function orderErrorMessage(code: string) {
  switch (code) {
    case 'bad_qty':
      return 'Quantity must be a positive number.';
    case 'bad_max_qty':
      return `Max quantity per order is ${MAX_QTY}.`;
    case 'bad_tick':
      return `Price must be in ${TICK_SIZE.toFixed(1)} increments.`;
    case 'bad_price':
      return `Price must be between ${FACE_MIN.toFixed(1)} and ${FACE_MAX.toFixed(1)}.`;
    default:
      return 'Invalid order inputs.';
  }
}

function formatEndsIn(endsAtISO?: string) {
  if (!endsAtISO) return '--';
  const ends = new Date(endsAtISO).getTime();
  const now = Date.now();
  const diff = ends - now;
  if (Number.isNaN(ends) || diff <= 0) return 'Ended';

  const sec = Math.floor(diff / 1000);
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);

  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function toPct10(price10: number) {
  
  return clamp(price10, 0, 10) * 10;
}

function TradeDashboard() {
  const { id: eventId } = useParams<{ id: string }>();

  const [depth, setDepth] = useState<Depth>({ bids: [], asks: [] });
  const [event, setEvent] = useState<EventMeta | null | undefined>(null);
  const [loading, setLoading] = useState(true);

  
  const [marketYes, setMarketYes] = useState<number | null>(null);

  
  const [intent, setIntent] = useState<Intent>('TRADE');
  const [side, setSide] = useState<OrderSide>('YES');
  const [orderType, setOrderType] = useState<OrderType>('LIMIT');
  const [price, setPrice] = useState(7.5);
  const [qty, setQty] = useState(100);

  
  const [liqOpen, setLiqOpen] = useState(false);
  const [liqQty, setLiqQty] = useState('');
  const [liqNotional, setLiqNotional] = useState('');

  
  const [posting, setPosting] = useState(false);
  const [liqPosting, setLiqPosting] = useState(false);

  const { balance, refreshBalance } = useBalance();


  useEffect(() => {
    if (!eventId) return;

    async function fetchInitial() {
      try {
        const [meta, book] = await Promise.all([
          apiClient.get<EventMeta[]>(`/events?id=${eventId}`),
          apiClient.get<Depth>(`/depth?eventId=${eventId}`),
        ]);
        if (meta.data.length > 0) setEvent(meta.data[0]);
        setDepth(book.data);
      } catch (err: any) {
        const errorMessage = err?.response?.data?.error || 'server';
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    }

    fetchInitial();
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;

    const ws = new WebSocket(`${WSS}?eventId=${eventId}`);

    ws.onopen = () => {
      ws.send(JSON.stringify({ msg: 'Hi!' }));
    };

    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.type === 'depth') setDepth(m.payload);
      if (m.type === 'trade') {
        const trades = (m.payload as Trade[]) || [];
        const [last] = trades;
        if (!last) return;

        const yesPrice = last.side === 'YES' ? last.price : 10 - last.price;
        setMarketYes(yesPrice);
      }
    };

    return () => ws.close();
  }, [eventId]);

  useEffect(() => {
    if (!depth?.bids?.length || !depth?.asks?.length) return;
    const bestBidYes = depth.bids[0]?.price || 0;
    const bestAskNo = depth.asks[0]?.price || 0;
    const midYes = (bestBidYes + (10 - bestAskNo)) / 2;
    if (marketYes === null) setMarketYes(midYes);
  }, [depth, marketYes]);

  const effectivePrice = useMemo(() => {
    if (orderType === 'LIMIT') return price;
    if (marketYes === null) return price;
    const raw = side === 'YES' ? marketYes : 10 - marketYes;
    return normalizePrice(raw);
  }, [marketYes, orderType, price, side]);

  const stake = useMemo(() => qty * effectivePrice, [effectivePrice, qty]);

  const postBalance = useMemo(() => {
    if (balance === null) return null;
    return balance - stake;
  }, [balance, stake]);

  const maxBidQty = useMemo(
    () => Math.max(1, ...depth.bids.map((r) => r.qty)),
    [depth.bids]
  );
  const maxAskQty = useMemo(
    () => Math.max(1, ...depth.asks.map((r) => r.qty)),
    [depth.asks]
  );

  const liqSize = useMemo(() => {
    const q = Number(liqQty);
    const n = Number(liqNotional);
    if (!isNaN(q) && q > 0) return { qty: q, notional: q * LIQ_PRICE };
    if (!isNaN(n) && n > 0) return { qty: n / LIQ_PRICE, notional: n };
    return { qty: 0, notional: 0 };
  }, [liqNotional, liqQty]);

  const liqPostBalance = useMemo(() => {
    if (balance === null) return null;
    return balance - liqSize.notional;
  }, [balance, liqSize.notional]);

  async function place() {
    if (!eventId) return;
    try {
      assertOrderValid(effectivePrice, qty);
    } catch (err: any) {
      toast.error(orderErrorMessage(err?.message || ''));
      return;
    }
    setPosting(true);
    try {
      await apiClient.post('/orders', {
        eventId,
        side,
        price: +effectivePrice,
        qty: +qty,
        orderType,
      });
      toast.success('Order placed');
      refreshBalance();
    } catch (err: any) {
      const errorMessage = err?.response?.data?.error || 'server';
      toast.error(errorMessage);
    } finally {
      setPosting(false);
    }
  }

  async function addLiquidity() {
    if (!eventId) return;
    setLiqPosting(true);
    try {
      const qtyPayload = Number(liqQty);
      const notionalPayload = Number(liqNotional);

      await apiClient.post('/liquidate', {
        eventId,
        side,
        qty: !isNaN(qtyPayload) && qtyPayload > 0 ? qtyPayload : undefined,
        notional:
          !isNaN(notionalPayload) && notionalPayload > 0
            ? notionalPayload
            : undefined,
      });

      toast.success('Liquidity added');
      setLiqQty('');
      setLiqNotional('');
      refreshBalance();
    } catch (err: any) {
      const errorMessage = err?.response?.data?.error || 'server';
      toast.error(errorMessage);
    } finally {
      setLiqPosting(false);
    }
  }

  function pickLimitPrice(yesPrice: number) {
    setIntent('TRADE');
    setOrderType('LIMIT');
    setPrice(normalizePrice(yesPrice));
  }

  useEffect(() => {
    if (intent === 'LIQUIDITY') setLiqOpen(true);
  }, [intent]);

  if (loading) {
    return (
      <div className="px-6 bg-zinc-950 min-h-screen py-24 grid lg:grid-cols-3 gap-4">
        <div className="col-span-2 flex flex-col gap-4">
          <Skeleton className="bg-zinc-500 h-[160px] rounded-xl" />
          <Skeleton className="bg-zinc-500 h-[420px] rounded-xl" />
        </div>
        <Skeleton className="bg-zinc-500 h-[620px] rounded-xl sticky top-24" />
      </div>
    );
  }

  const yesPx = marketYes ?? price;
  const noPx = 10 - yesPx;

  return (
    <div className="px-6 py-24 min-h-screen bg-zinc-950 text-zinc-200 font-mono">
      <div className="absolute -top-40 -left-40 w-120 h-60 bg-indigo-500 rounded-full blur-3xl opacity-30 animate-pulse" />
            <div className="absolute lg:-bottom-6 lg:-right-32 bottom-2 right-2 w-[12rem] h-[12rem] bg-fuchsia-500 rounded-full blur-3xl opacity-20 animate-pulse" />

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="col-span-2 flex flex-col gap-4">
          <Card className="bg-[#171717] border-zinc-800">
            <CardHeader className="space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <CardTitle className="text-2xl leading-tight">
                  {event?.title || 'Untitled event'}
                </CardTitle>

                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <span className="px-2 py-1 rounded-full border border-zinc-700">
                    Resolves in {formatEndsIn(event?.endsAt)}
                  </span>
                  {event?.endsAt && (
                    <span className="px-2 py-1 rounded-full border border-zinc-700">
                      {new Date(event.endsAt).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>

              <div className="text-sm text-zinc-400 leading-relaxed">
                {event?.description ? (
                  event.description
                ) : (
                  <span className="italic">
                   event description
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                <span className="px-2 py-1 rounded-full border border-zinc-700">
                  Market believes:{' '}
                  <span className="text-white">
                    {toPct10(yesPx).toFixed(0)}% YES
                  </span>
                </span>
                
                {event?.resolutionSource && (
                  <span className="px-2 py-1 rounded-full border border-zinc-700">
                    Resolves by: <span className="text-white">{event.resolutionSource}</span>
                  </span>
                )}
              </div>
            </CardHeader>
          </Card>

          <Card className="bg-[#171717] border-zinc-800">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-baseline gap-3">
                  <div className="text-sm text-zinc-400">Market</div>
                  <div className="text-xl font-semibold text-green-400">
                    YES ₹{yesPx.toFixed(1)}
                    <span className="ml-2 text-xs text-zinc-400">
                      ({toPct10(yesPx).toFixed(0)}%)
                    </span>
                  </div>
                  <div className="text-xl font-semibold text-red-400">
                    NO ₹{noPx.toFixed(1)}
                    <span className="ml-2 text-xs text-zinc-400">
                      ({toPct10(noPx).toFixed(0)}%)
                    </span>
                  </div>
                </div>

                <div className="text-xs text-zinc-400">
                  Click a price in the orderbook to prefill a limit order.
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#171717] border-zinc-800">
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <div className="text-sm text-zinc-300">Orderbook</div>
                <div className="text-xs text-zinc-500">
                  (Depth is secondary—market snapshot is the headline.)
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 pt-0">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="space-y-2">
                  <div className="flex justify-between text-zinc-400">
                    <span>YES Price</span>
                    <span>Qty</span>
                  </div>

                  <div className="space-y-1">
                    {depth.asks.slice(0, 14).map((r, idx) => {
                      const yesPrice = 10 - r.price;
                      const w = Math.round((r.qty / maxAskQty) * 100);
                      const isTop = idx === 0;
                      return (
                        <button
                          key={`ask-${r.price}`}
                          onClick={() => pickLimitPrice(yesPrice)}
                          className={[
                            'relative w-full text-left rounded-md px-2 py-1 border border-transparent hover:border-zinc-700 transition',
                            isTop ? 'bg-zinc-900/40' : 'bg-transparent',
                          ].join(' ')}
                          title="Click to set limit price"
                        >
                          <div
                            className="absolute inset-y-0 right-0 rounded-md bg-green-500/10"
                            style={{ width: `${w}%` }}
                          />
                          <div className="relative flex justify-between">
                            <span className="text-green-300">
                              {yesPrice.toFixed(1)}
                            </span>
                            <span className="text-zinc-200">{r.qty}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-zinc-400">
                    <span>NO Price</span>
                    <span>Qty</span>
                  </div>

                  <div className="space-y-1">
                    {depth.bids.slice(0, 14).map((r, idx) => {
                      const noPrice = 10 - r.price;
                      const yesPrice = 10 - noPrice;
                      const w = Math.round((r.qty / maxBidQty) * 100);
                      const isTop = idx === 0;
                      return (
                        <button
                          key={`bid-${r.price}`}
                          onClick={() => pickLimitPrice(yesPrice)}
                          className={[
                            'relative w-full text-left rounded-md px-2 py-1 border border-transparent hover:border-zinc-700 transition',
                            isTop ? 'bg-zinc-900/40' : 'bg-transparent',
                          ].join(' ')}
                          title="Click to set limit price (YES)"
                        >
                          <div
                            className="absolute inset-y-0 right-0 rounded-md bg-red-500/10"
                            style={{ width: `${w}%` }}
                          />
                          <div className="relative flex justify-between">
                            <span className="text-red-300">
                              {noPrice.toFixed(1)}
                            </span>
                            <span className="text-zinc-200">{r.qty}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-[#171717] border-zinc-800 sticky top-24 h-fit">
          <CardHeader className="space-y-3">
            <CardTitle className="text-xl">Place Order</CardTitle>

            <ToggleGroup
              type="single"
              value={intent}
              onValueChange={(val: string) => {
                if (!val) return;
                setIntent(val as Intent);
                if (val === 'TRADE') setLiqOpen(false);
              }}
              variant="outline"
              className="@[767px]/card:flex"
            >
              <ToggleGroupItem
                value="TRADE"
                className="rounded-full m-1 data-[state=on]:bg-white data-[state=on]:text-black"
              >
                Trade
              </ToggleGroupItem>
              <ToggleGroupItem
                value="LIQUIDITY"
                className="rounded-full m-1 data-[state=on]:bg-white data-[state=on]:text-black"
                onClick={() => setLiqOpen(true)}
              >
                Add Liquidity
              </ToggleGroupItem>
            </ToggleGroup>
          </CardHeader>

          <CardContent className="space-y-4">
            
            <div className="space-y-2">
              <div className="text-xs text-zinc-400">Belief</div>
              <ToggleGroup
                type="single"
                value={side}
                onValueChange={(val: string) => {
                  if (!val) return;
                  setSide(val as OrderSide);
                }}
                variant="outline"
                className="@[767px]/card:flex"
              >
                <ToggleGroupItem
                  value="YES"
                  className="rounded-full m-1 data-[state=on]:bg-white data-[state=on]:text-black"
                >
                  YES
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="NO"
                  className="rounded-full m-1 data-[state=on]:bg-white data-[state=on]:text-black"
                >
                  NO
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div className="space-y-2">
              <div className="text-xs text-zinc-400">Execution</div>
              <ToggleGroup
                type="single"
                value={orderType}
                onValueChange={(val: string) => {
                  if (!val) return;
                  const next = val as OrderType;
                  if (next === 'LIMIT' && orderType === 'MARKET' && marketYes !== null) {
                    if (isOffTick(marketYes)) {
                      setPrice(normalizePrice(marketYes));
                    }
                  }
                  setOrderType(next);
                }}
                variant="outline"
                className="@[767px]/card:flex"
              >
                {ORDER_TYPES.map((v) => (
                  <ToggleGroupItem
                    key={v}
                    value={v}
                    className="rounded-full m-1 data-[state=on]:bg-white data-[state=on]:text-black"
                  >
                    {v}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>

              <div className="text-[11px] text-zinc-500 leading-snug">
                {orderType === 'MARKET'
                  ? 'Market executes instantly at best available price.'
                  : 'Limit executes only at your price (or better).'}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs text-zinc-400">Price</div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    setPrice((p) =>
                      clamp(
                        Number((p - TICK_SIZE).toFixed(1)),
                        FACE_MIN,
                        FACE_MAX
                      )
                    )
                  }
                  className="text-black"
                  disabled={orderType === 'MARKET' || price <= FACE_MIN}
                >
                  <Minus className="h-4 w-4" />
                </Button>

                <Input
                  min={FACE_MIN}
                  max={FACE_MAX}
                  step={TICK_SIZE}
                  value={
                    orderType === 'MARKET'
                      ? effectivePrice.toFixed(2)
                      : price.toFixed(1)
                  }
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (isNaN(val)) return;
                    if (isOffTick(val)) {
                      toast.error(
                        `Price must be in ${TICK_SIZE.toFixed(1)} increments.`
                      );
                    }
                    setPrice(normalizePrice(val));
                  }}
                  disabled={orderType === 'MARKET'}
                  className="text-black text-center"
                />

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    setPrice((p) =>
                      clamp(
                        Number((p + TICK_SIZE).toFixed(1)),
                        FACE_MIN,
                        FACE_MAX
                      )
                    )
                  }
                  className="text-black"
                  disabled={orderType === 'MARKET' || price >= FACE_MAX}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            
            <div className="space-y-2">
              <div className="text-xs text-zinc-400">Quantity</div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  disabled={qty <= 1}
                  onClick={() => setQty((q) => clamp(q - 1, 1, MAX_QTY))}
                  className="text-black"
                >
                  <Minus className="h-4 w-4" />
                </Button>

                <Input
                  step="1"
                  min={1}
                  max={MAX_QTY}
                  value={qty}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (isNaN(val)) return;
                    if (val > MAX_QTY) {
                      toast.error(`Max quantity per order is ${MAX_QTY}.`);
                      setQty(MAX_QTY);
                      return;
                    }
                    setQty(clamp(val, 1, MAX_QTY));
                  }}
                  className="text-black text-center"
                />

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setQty((q) => clamp(q + 1, 1, MAX_QTY))}
                  className="text-black"
                  disabled={qty >= MAX_QTY}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              
              <div className="flex flex-wrap gap-2 pt-1">
                {[25, 50, 100].map((n) => (
                  <button
                    key={n}
                    className="text-xs px-2 py-1 rounded-full border border-zinc-700 hover:border-zinc-500 text-zinc-300"
                    onClick={() => setQty(n)}
                    type="button"
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-3 space-y-1">
              <div className="text-xs text-zinc-400">You are risking</div>
              <div className="text-lg font-semibold text-white">
                ₹{stake.toFixed(2)}
              </div>
              <div className="text-xs text-zinc-500">
                Effective price:{' '}
                <span className="text-zinc-300">{effectivePrice.toFixed(2)}</span>
              </div>

              {balance !== null && (
                <div className="text-xs text-zinc-500">
                  Balance after:{' '}
                  <span
                    className={
                      postBalance !== null && postBalance < 0
                        ? 'text-red-400'
                        : 'text-zinc-200'
                    }
                  >
                    ₹{postBalance !== null ? postBalance.toFixed(2) : '--'}
                  </span>
                </div>
              )}
            </div>

            <Button
              className="w-full"
              onClick={place}
              disabled={posting || intent !== 'TRADE'}
              title={intent !== 'TRADE' ? 'Switch intent to Trade' : 'Submit'}
            >
              {posting ? 'Submitting...' : 'Submit Trade'}
            </Button>
          </CardContent>
        </Card>
      </div>

      
      {liqOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => {
              setLiqOpen(false);
              setIntent('TRADE');
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <Card className="w-full max-w-lg bg-[#141414] border-zinc-800">
              <CardHeader className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-lg">
                    Add Liquidity @ ₹{LIQ_PRICE.toFixed(1)}
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="icon"
                    className="text-black"
                    onClick={() => {
                      setLiqOpen(false);
                      setIntent('TRADE');
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="text-xs text-zinc-400 leading-relaxed">
                  Liquidity is a deliberate action. You’re supporting the market
                  at a fixed price. Keep it separate from quick trades.
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="text-xs text-zinc-400">Qty</div>
                    <Input
                      type="number"
                      placeholder="Enter qty"
                      value={liqQty}
                      onChange={(e) => setLiqQty(e.target.value)}
                      className="text-black"
                    />
                  </div>
                  {/* <div className="space-y-1">
                    <div className="text-xs text-zinc-400">Amount</div>
                    <Input
                      type="number"
                      placeholder="Enter amount"
                      value={liqNotional}
                      onChange={(e) => setLiqNotional(e.target.value)}
                      className="text-black"
                    />
                  </div> */}
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-3 space-y-1">
                  <div className="text-xs text-zinc-400">Notional</div>
                  <div className="text-lg font-semibold text-white">
                    ₹{liqSize.notional.toFixed(2)}
                  </div>
                  <div className="text-xs text-zinc-500">
                    Computed qty:{' '}
                    <span className="text-zinc-200">
                      {liqSize.qty.toFixed(4)}
                    </span>
                  </div>

                  {balance !== null && (
                    <div className="text-xs text-zinc-500">
                      Balance after:{' '}
                      <span
                        className={
                          liqPostBalance !== null && liqPostBalance < 0
                            ? 'text-red-400'
                            : 'text-zinc-200'
                        }
                      >
                        ₹{liqPostBalance !== null ? liqPostBalance.toFixed(2) : '--'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <Button
                    className="w-full"
                    onClick={addLiquidity}
                    disabled={
                      liqPosting ||
                      (!liqSize.qty && !liqSize.notional) ||
                      !eventId
                    }
                  >
                    {liqPosting ? 'Submitting...' : 'Add Liquidity'}
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full text-black"
                    onClick={() => {
                      setLiqOpen(false);
                      setIntent('TRADE');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
      <ToastContainer />
    </div>
  );
}

export default withProtectedRoute(TradeDashboard);
