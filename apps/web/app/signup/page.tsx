"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast, ToastContainer } from "react-toastify"
import { signupSchema } from "@repo/common"

import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import axios from "axios"
import { HTTP_BACKEND_URL } from "../config"

interface signUpError {
    firstName?: string[] | undefined;
    lastName?: string[] | undefined;
    email?: string[] | undefined;
    password?: string[] | undefined;
}

export default function SignUp() {
    const [firstName, setFirstName] = useState("")
    const [lastName, setLastName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [err, setErr] = useState<signUpError>({})
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);


    const router = useRouter()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            const parsedData = signupSchema.safeParse({
                email, password, firstName, lastName
            })
            if (parsedData.error) {
                setErr(parsedData.error.flatten().fieldErrors)
                return
            }
            setLoading(true);

            const result = await axios.post(`${HTTP_BACKEND_URL}/api/v1/sign-up`, {
                firstName, lastName, email, password
            })
            toast(result.data?.msg);
            setTimeout(() => {
               
                setLoading(false);
            }, 1500);
            if (result.data?.id) {
                router.push("/signin")
            }

        } catch (error) {
            console.log(error);
            toast("Oops Something went wrong!");
        }



    }

    return (
        <div className="flex min-h-screen bg-gray-50">
            <div className="w-full lg:w-1/2 flex flex-col p-6 md:p-12 justify-center animate-fade-in">
                <div className="max-w-md w-full mx-auto">


                    <div className="space-y-2 mb-8">

                        <h1 className="text-2xl font-bold">Create your account</h1>
                        <p className="text-gray-500">Sign up to start creating and collaborating.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="firstName" >
                                    First Name
                                </Label>
                                <Input
                                    type="text"
                                    id="firstName"
                                    value={firstName}
                                    placeholder="Enter your first name"

                                    onChange={(e) => setFirstName(e.target.value)}
                                    required

                                />
                                {err && err?.firstName && <div className="">{err?.firstName[0]}</div>}
                            </div>
                            <div className="space-y-4">
                                <Label htmlFor="lastName" >
                                    Last Name
                                </Label>
                                <Input
                                    type="text"
                                    id="lastName"
                                    value={lastName}
                                    placeholder="Enter your last name"

                                    onChange={(e) => setLastName(e.target.value)}
                                    required

                                />
                                {err && err?.lastName && <div className="">{err?.lastName[0]}</div>}
                            </div>
                            <div className="space-y-4">
                                <Label htmlFor="email" >
                                    Email
                                </Label>
                                <Input
                                    type="email"
                                    id="email"
                                    value={email}
                                    placeholder="Enter your email"
                                    onChange={(e) => setEmail(e.target.value)}
                                    required

                                />
                                {err && err?.email && <div className="">{err?.email[0]}</div>}
                            </div>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="password">Password</Label>

                                </div>

                                <div className="relative">
                                    <Input

                                        id="password"
                                        value={password}
                                        placeholder="Create your password"
                                        type={showPassword ? "text" : "password"}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required

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
                                {loading ? "Creating account..." : "Create account"}
                            </Button>
                        </div>
                    </form>



                    <div className="mt-8 text-center text-sm">
                        Already have an account?{' '}
                        <Link href="/signin" className="font-medium text-primary hover:text-primary/80">
                            Sign in
                        </Link>
                    </div>
                </div>
            </div>

            <div className="hidden lg:block lg:w-1/2 relative bg-primary overflow-hidden">
                <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-500 rounded-full blur-3xl opacity-30 animate-pulse"></div>
                <div className="absolute -bottom-32 -right-32 w-[28rem] h-[28rem] bg-fuchsia-500 rounded-full blur-3xl opacity-20 animate-pulse"></div>
                <div className="absolute inset-0 bg-mesh-pattern opacity-10"></div>

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

                        <h2 className="text-2xl font-bold mb-4">Join our creative community</h2>
                        <p className="text-white/80 mb-6">
                            Shapesmith helps teams visualize ideas, create diagrams, and collaborate in real-time.
                        </p>

                        <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto">
                            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-left">
                                <div className="font-medium mb-1">10,000+</div>
                                <div className="text-xs text-white/70">Active users</div>
                            </div>
                            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-left">
                                <div className="font-medium mb-1">50,000+</div>
                                <div className="text-xs text-white/70">Projects created</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <ToastContainer/>
        </div>
    )
}



















