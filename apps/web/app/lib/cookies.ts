'use client'

import { ACCESS_TOKEN, REFRESH_TOKEN, USER_ID } from "@repo/common"

export const CLIENT_AUTH_COOKIE = ACCESS_TOKEN
export const CLIENT_REFRESH_COOKIE = REFRESH_TOKEN
export const CLIENT_USER_ID_COOKIE = USER_ID

export function getCookie(name: string): string | null {
    if (typeof document === "undefined") return null

    const match = document.cookie
        ?.split(";")
        .map((cookie) => cookie.trim())
        .find((cookie) => cookie.startsWith(`${name}=`))

    if (!match) return null
    return decodeURIComponent(match.split("=").slice(1).join("="))
}
