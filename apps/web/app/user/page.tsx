'use client';

import { useContext, useEffect, useState } from 'react';
import { z } from 'zod';

import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@repo/ui/components/card';
import { Button } from '@repo/ui/components/button';
import { Input } from '@repo/ui/components/input';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { withProtectedRoute } from '../context/withProtectedRoute';

const amountSchema = z.number().int().min(10).max(10_000);

const QUICK = [100, 500, 1_000] as const;
function UserWalletCard() {
    const [balance, setBalance] = useState<number | null>(null);
    const [custom, setCustom] = useState('');
    const [msg, setMsg] = useState('');
    const [token, setToken] = useState<string | null>(null);

    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";


    useEffect(() => {
        
        const localToken = localStorage.getItem('oddsCraftToken');
        setToken(localToken);
    }, []);

    useEffect(() => {
        
        const getBalance=async()=>{
            if (!token) return;
            try {
                console.log(token);
                const balance = await axios.get(`${API_BASE}/api/v1/me/balance`,{
                    headers:{
                        Authorization: `Bearer ${token}`
                    }
                })
                setBalance(balance.data.balance)
                console.log(balance);
            } catch (error) {
                console.log(error);
                setMsg('⚠︎ could not fetch balance')
            }
        }
        
        getBalance()
    }, [token]);

  
    async function topUp(amount: number) {
        setMsg('processing…');
        try {
            await axios.post(`${API_BASE}/api/v1/wallet/topup`,{
                amt:amount
            }, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            })
      
            setBalance(b => (b ?? 0) + amount);
            setMsg('✅ balance updated');
            setCustom('');
        } catch (e: any) {
            setMsg(e.response?.data?.error || 'server');
        }
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
        <div className="px-6 text-white py-32 space-y-6 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-800 h-screen">

            <div className="absolute -top-40 -left-40 w-80 h-80 bg-indigo-500 rounded-full blur-3xl opacity-30 animate-pulse"></div>
            <div className="absolute -bottom-6 -right-32 w-[12rem] h-[12rem] bg-fuchsia-500 rounded-full blur-3xl opacity-20 animate-pulse"></div>
            <Card className="max-w-xl p-4 mx-auto">
            <CardHeader>
                <CardTitle className="text-xl">Wallet</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
                <div className="text-4xl font-extrabold text-emerald-400">
                    {balance === null ? '—' : `₹${balance.toFixed(2)}`}
                </div>

                <div className="flex gap-3">
                    {QUICK.map(v => (
                        <Button key={v} variant="outline" className="flex-1 text-black"
                            onClick={() => topUp(v)}>
                            +₹{v}
                        </Button>
                    ))}
                </div>

                <div className="flex gap-2">
                    <Input placeholder="custom"
                        type="number"
                        value={custom}
                        onChange={e => setCustom(e.target.value)}
                        className="flex-1 text-black" />
                    <Button onClick={submitCustom}>Add</Button>
                </div>

                {msg && <p className="text-xs text-zinc-400">{msg}</p>}
            </CardContent>

            <CardFooter className="text-xs text-zinc-500 p-2">
                Funds are demo rupees. Top-ups are instant for testing.
            </CardFooter>
        </Card>
        </div>
    );
}
export default withProtectedRoute(UserWalletCard)
