"use client"
import { useState, useEffect, useContext } from 'react';
import Link from 'next/link';
import { Button } from "@repo/ui/components/button";
import { Menu, UserIcon, Wallet, X } from 'lucide-react';
import { AuthContext } from "../context/AuthContext";

import { useRouter } from "next/navigation";
import useBalance from '../hooks/useBalance';


const Navbar = () => {
    const [isScrolled, setIsScrolled] = useState(false);
    const balance=useBalance()
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const context = useContext(AuthContext);
    if (!context) {
        return null;
    }
    const { login, handleLogOut } = context
    const router = useRouter();

    const handleLogOutNav = () => {
        handleLogOut();
        router.push('/')
    }

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 10);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [login]);

    return (
        <nav
            className={`fixed w-full top-0 left-0 right-0 z-50 py-4 px-6 md:px-10 transition-all duration-300 ${isScrolled ? ' backdrop-blur-lg shadow-sm' : 'bg-transparent'
          }`}
        >
            <div className="max-w-full mx-auto flex items-center justify-between">
                <Link
                    href="/"
                    className="flex items-center space-x-2"
                >
                   
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500  flex items-center justify-center shadow-md">
                        <span className="text-white font-bold text-xl">OC</span>
                    </div>
                </Link>

                <div className="hidden md:flex items-center space-x-8">

                    {!login && <div className="flex items-center space-x-4">
                        <Link href="/signin">
                            <Button variant="outline" size="sm" className="px-4 hover:cursor-pointer">
                                Sign In
                            </Button>
                        </Link>
                        <Link href="/signup">
                            <Button size="sm" className="px-4 hover:cursor-pointer">
                                Sign Up
                            </Button>
                        </Link>
                    </div>}
                    {login && <div className="flex items-center space-x-4">
                        <Link href="/user">
                            <Button variant="outline" size="sm" className="px-4 hover:cursor-pointer">
                                <Wallet className='' />
                              
                                <div className=''>₹{balance}</div>
                            </Button>
                        </Link>
                        

                        <Button size="sm" className="px-4" onClick={handleLogOutNav}>
                            <UserIcon className="h-5 w-5 mr-1" />
                            Logout
                        </Button>

                    </div>}

                </div>

                <div className="md:hidden">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        aria-label="Toggle menu"
                    >
                        {mobileMenuOpen ? <X className="h-5 w-5 text-white" /> : <Menu className="h-5 w-5 text-white" />}
                    </Button>
                </div>
            </div>

            {mobileMenuOpen && (
                <div className="md:hidden absolute top-full left-0 right-0  backdrop-blur-lg border-b border-gray-200 shadow-sm p-6 animate-fade-in">
                    <div className="flex flex-col space-y-5">
                        <Link
                            href="/"
                            className="text-base font-medium transition-colors text-white"
                            onClick={() => setMobileMenuOpen(false)}
                        >
                            Home
                        </Link>

                        {!login && <div className="pt-2 flex flex-col space-y-3">
                            <Link
                                href="/signin"
                                onClick={() => setMobileMenuOpen(false)}
                            >
                                <Button variant="outline" className="w-full">Sign In</Button>
                            </Link>
                            <Link
                                href="/signup"
                                onClick={() => setMobileMenuOpen(false)}
                            >
                                <Button className="w-full">Sign Up</Button>
                            </Link>
                        </div>}
                        {login && <div className="pt-2 flex flex-col space-y-3">

                            <Button className="w-full " onClick={handleLogOut}><UserIcon className="h-5 w-5 mr-1" />
                                Logout</Button>
                        </div>}
                    </div>
                </div>
            )}
        </nav>
    );
};

export default Navbar;

