'use client';
import  { useEffect, useMemo, useState } from 'react'

import axios from 'axios';






const useBalance = () => {
    const [balance, setBalance] = useState<number | null>(0);
    const [token, setToken] = useState<string | null>(null);

    const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    const headers = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

    async function getBalance() {
        try {
            const bal = await axios.get<{ balance: number }>(`${API}/api/v1/me/balance`, headers)
            setBalance(bal.data.balance);
        } catch (error) {
            console.log(error);
        }
    }
    useEffect(() => { setToken(localStorage.getItem('oddsCraftToken')); }, []);
    useEffect(() => { if (token) getBalance(); }, [token]);


    

    return (
       balance
    )
}

export default useBalance