'use client'

import axios, { type AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios"
import { AUTH_TOKEN, USER_ID } from "@repo/common"
import { HTTP_BACKEND_URL } from "../config"
import { getCookie } from "./cookies"

type AuthRequestConfig = InternalAxiosRequestConfig & { _retry?: boolean }
type PendingRequest = {
    resolve: (value: AxiosResponse) => void
    reject: (error: AxiosError) => void
    config: AuthRequestConfig
}

const API_BASE = HTTP_BACKEND_URL || "http://localhost:3001"

const apiClient = axios.create({
    baseURL: API_BASE,
    withCredentials: true,
})

let isRefreshing = false
let failedQueue: PendingRequest[] = []
let unauthorizedHandler: (() => void) | null = null

const processQueue = (error?: AxiosError) => {
    failedQueue.forEach(({ config, resolve, reject }) => {
        if (error) {
            reject(error)
            return
        }
        apiClient(config).then(resolve).catch(reject)
    })
    failedQueue = []
}

export const setUnauthorizedHandler = (handler: () => void) => {
    unauthorizedHandler = handler
}

apiClient.interceptors.request.use((config) => {
    const token = getCookie(AUTH_TOKEN)
    const userId = getCookie(USER_ID)

    if (token) {
        config.headers = {
            ...config.headers,
            Authorization: `Bearer ${token}`,
        }
    }

    if (userId) {
        config.headers = {
            ...config.headers,
            "x-user-id": userId,
        }
    }

    return config
})

apiClient.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const status = error.response?.status
        const originalRequest = error.config as AuthRequestConfig | undefined

        if (!originalRequest || originalRequest.url?.includes("/auth/refresh")) {
            return Promise.reject(error)
        }

        if (status === 401 && !originalRequest._retry) {
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject, config: originalRequest })
                })
            }

            originalRequest._retry = true
            isRefreshing = true

            try {
                await apiClient.post("/auth/refresh")
                processQueue()
                return apiClient(originalRequest)
            } catch (refreshErr) {
                const axiosErr = refreshErr as AxiosError
                processQueue(axiosErr)
                unauthorizedHandler?.()
                return Promise.reject(axiosErr)
            } finally {
                isRefreshing = false
            }
        }

        return Promise.reject(error)
    }
)

export { apiClient }
export default apiClient
