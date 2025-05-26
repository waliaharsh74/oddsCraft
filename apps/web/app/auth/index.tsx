"use client";

import { useState } from "react";
import { z } from "zod"; 
import { Side, TradeMsg, OrderBook, signupSchema, signinSchema, cancelSchema, orderSchema } from "@repo/common"
import api, { setToken } from "../api";
import { Card, CardHeader, CardTitle, CardContent } from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { Button } from "@repo/ui/components/button";

const formSchema = signupSchema
type Form = z.infer<typeof formSchema>;

interface Props { onAuth: () => void; }

export default function AuthCard({ onAuth }: Props) {
    const [form, setForm] = useState<Form>({ email: "", password: "" });
    const [mode, setMode] = useState<"signin" | "signup">("signin");
    const [err, setErr] = useState("");

    async function submit() {
        const parse = formSchema.safeParse(form);
        if (!parse.success) { setErr(parse?.error?.issues[0]?.message || "Parsing Error"); return; }

        try {
            const url = mode === "signin" ? "/api/v1/auth/signin" : "/api/v1/auth/signup";
            const { data } = await api.post(url, form);
            setToken(data.token);
            onAuth();
        } catch (e: any) {
            setErr(e.response?.data?.error || "server");
        }
    }

    return (
        <Card className="mx-auto mt-24 w-full max-w-sm">
            <CardHeader><CardTitle>{mode === "signin" ? "Sign In" : "Sign Up"}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
                <Input placeholder="email" value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })} />
                <Input placeholder="password" type="password" value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })} />
                {err && <p className="text-red-400 text-xs">{err}</p>}
                <Button className="w-full" onClick={submit}>
                    {mode === "signin" ? "Sign in" : "Create account"}
                </Button>
                <button className="text-xs mt-1 underline"
                    onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setErr(""); }}>
                    {mode === "signin" ? "Need an account?" : "Already have an account?"}
                </button>
            </CardContent>
        </Card>
    );
}
