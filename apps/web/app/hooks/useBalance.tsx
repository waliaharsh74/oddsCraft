'use client';
import  { useCallback, useEffect, useMemo, useState } from 'react'

import axios from 'axios';






const useBalance = () => {
    const [balance, setBalance] = useState<number | null>(null);
    const [token, setToken] = useState<string | null>(null);

    const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const headers = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

    const fetchBalance = useCallback(async () => {
        if (!token) return;
        try {
            const bal = await axios.get<{ balance: number; balancePaise: string; decimal: number }>(`${API}/api/v1/me/balance`, headers)
            setBalance(bal.data.balance);
        } catch (error) {
            console.log(error);
        }
    }, [API, headers, token]);

    useEffect(() => { setToken(localStorage.getItem('oddsCraftToken')); }, []);
    useEffect(() => { if (token) fetchBalance(); }, [token, fetchBalance]);

    return {
        balance,
        refreshBalance: fetchBalance
    }
}

export default useBalance
