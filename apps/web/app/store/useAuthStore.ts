'use client'

import axios, { type AxiosError } from "axios"
import { create } from "zustand"
import { persist } from "zustand/middleware"
import apiClient, { setUnauthorizedHandler } from "../lib/api-client"

export type AuthUser = {
    id: string
    email: string
    role?: string | null
}

export type AuthState = {
    user: AuthUser | null
    isAuthenticated: boolean
    isLoading: boolean
    initialized: boolean
    error: string | null
    initialize: () => Promise<void>
    login: (email: string, password: string) => Promise<void>
    signup: (email: string, password: string) => Promise<void>
    logout: () => Promise<void>
    refreshProfile: () => Promise<void>
    setUser: (user: AuthUser | null) => void
    setError: (error: string | null) => void
}

const getErrorMessage = (err: unknown) => {
    if (axios.isAxiosError(err)) {
        const data = err.response?.data as any
        return data?.error?.message || data?.error || err.message || "Request failed"
    }
    return "Something went wrong"
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            initialized: false,
            error: null,
            setUser: (user) => set({ user, isAuthenticated: !!user }),
            setError: (error) => set({ error }),
            initialize: async () => {
                if (get().initialized) return
                set({ isLoading: true, error: null })
                try {
                    const { data } = await apiClient.get("/auth/me")
                    set({ user: data.user, isAuthenticated: true })
                } catch (err) {
                    set({ user: null, isAuthenticated: false, error: getErrorMessage(err) })
                } finally {
                    set({ isLoading: false, initialized: true })
                }
            },
            login: async (email, password) => {
                set({ isLoading: true, error: null })
                try {
                    const { data } = await apiClient.post("/auth/signin", { email, password })
                    set({ user: data.user, isAuthenticated: true, initialized: true })
                } catch (err) {
                    set({ error: getErrorMessage(err), isAuthenticated: false })
                    throw err
                } finally {
                    set({ isLoading: false })
                }
            },
            signup: async (email, password) => {
                set({ isLoading: true, error: null })
                try {
                    const { data } = await apiClient.post("/auth/signup", { email, password })
                    set({ user: data.user, isAuthenticated: true, initialized: true })
                } catch (err) {
                    set({ error: getErrorMessage(err), isAuthenticated: false })
                    throw err
                } finally {
                    set({ isLoading: false })
                }
            },
            logout: async () => {
                try {
                    await apiClient.post("/auth/logout")
                } catch (err) {
                    const axiosErr = err as AxiosError
                    console.warn("Failed to clear auth cookies", axiosErr.message)
                }
                set({ user: null, isAuthenticated: false, initialized: true, error: null })
            },
            refreshProfile: async () => {
                try {
                    const { data } = await apiClient.get("/auth/me")
                    set({ user: data.user, isAuthenticated: true })
                } catch (err) {
                    set({ user: null, isAuthenticated: false, error: getErrorMessage(err) })
                    throw err
                }
            },
        }),
        {
            name: "auth-store",
            partialize: (state) => ({
                user: state.user,
                isAuthenticated: state.isAuthenticated,
            }),
        }
    )
)

setUnauthorizedHandler(() => {
    useAuthStore.setState({
        user: null,
        isAuthenticated: false,
        initialized: true,
        error: "Session expired. Please sign in again."
    })
})
