
'use client';
import { createChart, CrosshairMode, ISeriesApi, CandlestickSeries } from 'lightweight-charts';
import { useEffect, useRef } from 'react';

export default function CandleChart() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = createChart(ref.current, {
      width: ref.current.clientWidth,
      height: 400,
      // @ts-ignore
      layout: { textColor: '#CBD5E1', background: { type: 'solid', color: 'transparent' } },
      grid: { vertLines: { color: 'rgba(255,255,255,0.05)' }, horzLines: { color: 'rgba(255,255,255,0.05)' } },
      crosshair: { mode: CrosshairMode.Normal },
      timeScale: { borderColor: 'rgba(255,255,255,0.1)' },
      priceScale: { borderColor: 'rgba(255,255,255,0.1)' },
    });
    const candleSeries = chart.addSeries(CandlestickSeries,{
      upColor: '#22c55e',
      downColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      borderVisible: false,
    });

  
    const data = [];
    let t = Math.floor(Date.now() / 1000) - 60 * 60;
    let price = 100;
    for (let i = 0; i < 60; i++) {
      const open = price;
      const close = price + (Math.random() - 0.5) * 4;
      const high = Math.max(open, close) + Math.random() * 2;
      const low = Math.min(open, close) - Math.random() * 2;
      data.push({ time: t, open, high, low, close });
      price = close;
      t += 60;
    }
    // @ts-ignore
    candleSeries.setData(data);

    const handleResize = () => {
      chart.applyOptions({ width: ref.current!.clientWidth });
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  return <div ref={ref} className="w-full h-[400px]" />;
}
