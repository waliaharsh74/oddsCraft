'use client';

import { useCallback, useEffect, useState } from 'react'
import apiClient from '../lib/api-client';
import { useAuthStore } from '../store/useAuthStore';
import { useShallow } from 'zustand/react/shallow'


const useBalance = () => {
    const [balance, setBalance] = useState<number | null>(null);
    const { isAuthenticated, initialized } = useAuthStore(useShallow((state) => ({
        isAuthenticated: state.isAuthenticated,
        initialized: state.initialized,
    })))

    const fetchBalance = useCallback(async () => {
        if (!isAuthenticated) {
            setBalance(null)
            return
        }
        try {
            const bal = await apiClient.get<{ balance: number; balancePaise: string; decimal: number }>("/api/v1/me/balance")
            setBalance(bal.data.balance);
        } catch (error) {
            console.log(error);
        }
    }, [isAuthenticated]);

    useEffect(() => {
        if (initialized) fetchBalance();
    }, [initialized, fetchBalance]);

    return {
        balance,
        refreshBalance: fetchBalance
    }
}

export default useBalance
