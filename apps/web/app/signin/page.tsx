"use client"

import type React from "react"
import { useContext, useState } from "react"
import { useRouter } from "next/navigation"
import {  toast, ToastContainer } from 'react-toastify';
import {  signinSchema } from "@repo/common";
import Link from 'next/link';
import {  Eye, EyeOff } from 'lucide-react';
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { AuthContext } from "../context/AuthContext";
import 'dotenv/config'


import axios from "axios"
import { HTTP_BACKEND_URL } from "../config";

interface signInError{
    email?: string[] | undefined;
    password?: string[] | undefined
}

export default function SignIn() {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [loading, setLoading] = useState(false);

    const [showPassword, setShowPassword] = useState(false);
    const context = useContext(AuthContext);
    if (!context) {
        return null;
    }
    const { setLogin } = context;
   
    const [err, setErr] = useState<signInError>({})
    const router = useRouter()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            const parsedData = signinSchema.safeParse({
                email, password
            })
            if (parsedData.error) {
                setErr(parsedData.error.flatten().fieldErrors)
                return
            }
            setLoading(true);

            const result = await axios.post(`${HTTP_BACKEND_URL}/api/v1/auth/signin`, {
                email, password
            })
            toast.success(result.data?.msg);
            setTimeout(() => {
                
                setLoading(false);
                if (result.data?.token){
                    localStorage.setItem("oddsCraftToken", result.data?.token)
                    setLogin(true);
                    router.push('/dashboard')
                }
            }, 1500);
            
        } catch (error) {
            console.log(error);
            if (axios.isAxiosError(error)) {
                const message = error.response?.data?.error || error.message || "Oops! Something went wrong.";
                toast.error(message);
            } else {
                toast("An unexpected error occurred.");
            }
            setLoading(false)
        }
        
        
    }

    return (
        <div className="flex min-h-screen bg-gray-50">
            <div className="w-full lg:w-1/2 flex flex-col p-6 md:p-12 justify-center animate-fade-in">
                <div className="max-w-md w-full mx-auto">
               

                    <div className="space-y-2 mb-8">
                    
                        <h1 className="text-2xl font-bold">Welcome back</h1>
                        <p className="text-gray-500">Sign in to your account to continue.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email address</Label>
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    placeholder="Enter your email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                                {err && err?.email && <div className="">{err?.email[0]}</div>}

                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="password">Password</Label>
                                    
                                </div>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        name="password"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Enter your password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        className="pr-10"
                                    />

                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                        aria-label={showPassword ? "Hide password" : "Show password"}
                                    >

                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                    {err && err?.password && <div className="">{err?.password[0]}</div>}

                                </div>
                            </div>



                            <Button type="submit" className="w-full" disabled={loading}>
                                {loading ? "Signing in..." : "Sign in"}
                            </Button>
                            </div>
                    </form>

                

                    <div className="mt-8 text-center text-sm">
                        Don't have an account?{' '}
                        <Link href="/signup" className="font-medium text-primary hover:text-primary/80">
                            Sign up
                        </Link>
                    </div>
                </div>
            </div>

            <div className="hidden lg:block lg:w-1/2 relative bg-primary overflow-hidden from-zinc-950 via-zinc-900 to-zinc-800 ">
                <div className="absolute inset-0 bg-mesh-pattern opacity-10"></div>
                <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-500 rounded-full blur-3xl opacity-30 animate-pulse"></div>
                <div className="absolute -bottom-32 -right-32 w-[28rem] h-[28rem] bg-fuchsia-500 rounded-full blur-3xl opacity-20 animate-pulse"></div>

                <div className="absolute inset-0 flex flex-col justify-center items-center p-12 text-white">
                    <div className="max-w-md text-center">
                        <svg className="w-32 h-32 mx-auto mb-8 text-white/90" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <g className="animate-float">
                                <rect x="20" y="20" width="30" height="30" rx="4" fill="currentColor" fillOpacity="0.7" />
                            </g>
                            <g className="animate-float" style={{ animationDelay: '1s' }}>
                                <circle cx="65" cy="65" r="15" fill="currentColor" fillOpacity="0.7" />
                            </g>
                            <g className="animate-float" style={{ animationDelay: '0.5s' }}>
                                <path d="M50 15L65 40L35 40L50 15Z" fill="currentColor" fillOpacity="0.7" />
                            </g>
                        </svg>

                        <h2 className="text-2xl font-bold mb-4">Welcome back to Shapesmith</h2>
                        <p className="text-white/80 mb-6">
                            Continue creating and collaborating on your visual projects with your team.
                        </p>

                        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-left">
                            <blockquote className="text-sm italic text-white/90 mb-3">
                                "Shapesmith has transformed how our team visualizes ideas. The collaborative features are incredibly intuitive."
                            </blockquote>
                            <div className="flex items-center">
                                <div className="w-8 h-8 rounded-full bg-white/20 mr-3"></div>
                                <div>
                                    <div className="text-xs font-medium">Sarah Johnson</div>
                                    <div className="text-xs text-white/60">Product Designer at Acme Inc.</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <ToastContainer/>
        </div>
    )
}

