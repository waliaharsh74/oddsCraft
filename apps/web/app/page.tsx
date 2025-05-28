
'use client';
import CandleChart from './components/CandleChart';
import useGsapLanding from './components/useGsapLanding';
import LogoReveal from './components/LogoReveal';
import { Button } from '@repo/ui/components/button';
import Link from 'next/link';
import { useEffect } from 'react';

export default function LandingPage() {

  useEffect(()=>{

  },[])
  useGsapLanding();

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-800 overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-500 rounded-full blur-3xl opacity-30 animate-pulse"></div>
      <div className="absolute -bottom-32 -right-32 w-[28rem] h-[28rem] bg-fuchsia-500 rounded-full blur-3xl opacity-20 animate-pulse"></div>

      {/* <header className="flex items-center justify-between px-8 py-6 relative z-10">

        <h1 className="text-2xl font-extrabold text-white">Oddscraft</h1>
        <nav className="space-x-4">
          <Link href="/signin"><Button variant="ghost">Sign in</Button></Link>
          <Link href="/signup"><Button>Get started</Button></Link>
        </nav>
      </header> */}

      <main className="relative z-10 flex flex-col lg:flex-row items-center justify-center px-6 lg:px-24 pt-10 lg:pt-0 gap-12">
        {/* Hero copy */}
        <div className="max-w-lg text-center lg:text-left">
          <h2 className="hero-tagline text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400 bg-clip-text text-transparent">
            Trade Outcomes.<br/>Shape Probability.
          </h2>
          <p className="hero-sub mt-4 text-zinc-300 text-lg">
            Bet on live events with lightning‑fast order‑books, dynamic pricing, and transparent odds.
          </p>
          <div className="mt-8 flex justify-center lg:justify-start gap-4">
            <Link href="/signup"><Button size="lg">Start Trading</Button></Link>
            <Link href="/learn"><Button variant="outline" size="lg">Learn more</Button></Link>
          </div>
        </div>
        

        {/* Hero chart */}
        <div className="hero-chart w-full lg:w-[520px] rounded-lg ring-1 ring-zinc-700 backdrop-blur-md/40 bg-zinc-800/30 p-4">
          <CandleChart />
        </div>
      </main>
    </div>
  );
}
