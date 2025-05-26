"use client"
import axios from "axios";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const api = axios.create({ baseURL: API_BASE });

export function setToken(token: string | null) {
    if (token) {
        localStorage.setItem("oddsCraftToken", token);
        api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } else {
        localStorage.removeItem("oddsCraftToken");
        delete api.defaults.headers.common["Authorization"];
    }
}

setToken(localStorage.getItem("oddsCraftToken"));

export default api;
