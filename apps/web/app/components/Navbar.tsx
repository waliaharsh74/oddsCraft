"use client"
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from "@repo/ui/components/button";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@repo/ui/components/tooltip"
import { Menu, UserIcon, X, User } from 'lucide-react';
import { useRouter } from "next/navigation";
import { useAuthStore } from '../store/useAuthStore';
import { useShallow } from 'zustand/react/shallow'


const Navbar = () => {
    const [isScrolled, setIsScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const { isAuthenticated, logout, initialize, initialized, user } = useAuthStore(useShallow((state) => ({
        isAuthenticated: state.isAuthenticated,
        logout: state.logout,
        initialize: state.initialize,
        initialized: state.initialized,
        user: state.user
    })))
    const router = useRouter();

    useEffect(() => {
        initialize()
    }, [initialize])

    const handleLogOutNav = async () => {
        await logout();
        router.push('/')
    }

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 10);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

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

                    {!isAuthenticated && initialized && <div className="flex items-center space-x-4">
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
                    {isAuthenticated && initialized && <div className="flex items-center space-x-4">
                        <Link href="/user">
                            <Button variant="outline" size="sm" className="px-4 hover:cursor-pointer">
                                <User className='' />
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div >{(user?.email)?.slice(0, 7).toLocaleString() + "..."}</div>
                                    </TooltipTrigger>
                                    <TooltipContent className='p-2 m-1 bg-white'>
                                        {(user?.email)}
                                    </TooltipContent>
                                </Tooltip>

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

                        {!isAuthenticated && initialized && <div className="pt-2 flex flex-col space-y-3">
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
                        {isAuthenticated && initialized && <div className="pt-2 flex flex-col space-y-3">

                            <Button className="w-full " onClick={handleLogOutNav}><UserIcon className="h-5 w-5 mr-1" />
                                Logout</Button>
                        </div>}
                    </div>
                </div>
            )}
        </nav>
    );
};

export default Navbar;

