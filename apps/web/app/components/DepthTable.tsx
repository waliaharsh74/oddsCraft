import { useMemo } from 'react';

interface Row { price: number; qty: number }
interface Props {
    bids: Row[];        
    asks: Row[];        
}

const VISIBLE = 7;

export default function DepthTable({ bids, asks }: Props) {
    const [sliceBids, sliceAsks, maxQty] = useMemo(() => {
        const b = bids.slice(0, VISIBLE);
        const a = asks.slice(0, VISIBLE);
        const m = Math.max(
            ...b.map(r => r.qty),
            ...a.map(r => r.qty),
            1       
        );
        return [b, a, m];
    }, [bids, asks]);

    const w = (qty: number) => `${(qty / maxQty) * 100}%`;

    return (
        <div className="grid grid-cols-3 text-xs font-mono">
            <div className="space-y-[2px]">
                {sliceBids.map(r => (
                    <div key={r.price} className="relative flex justify-end pr-1">
                        <span className="z-10">{r.qty}</span>
                        <div
                            className="absolute right-0 top-0 bottom-0 bg-sky-500/40 transition-all"
                            style={{ width: w(r.qty) }}
                        />
                        <span className="sr-only">{r.price}</span>
                    </div>
                ))}
            </div>

            <div className="space-y-[2px] border-l border-r border-zinc-700/50 text-center">
                {[...sliceAsks].reverse().map(r => (
                    <div key={r.price}>{r.price.toFixed(1)}</div>
                ))}
            </div>

            <div className="space-y-[2px]">
                {sliceAsks.map(r => (
                    <div key={r.price} className="relative pl-1">
                        <span className="z-10">{r.qty}</span>
                        <div
                            className="absolute left-0 top-0 bottom-0 bg-rose-500/40 transition-all"
                            style={{ width: w(r.qty) }}
                        />
                        <span className="sr-only">{r.price}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
