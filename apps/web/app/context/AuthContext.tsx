// AuthContext.tsx
"use client"
import { createContext, useState, useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";

interface AuthContextType {
    login: boolean;
    setLogin: (status: boolean) => void;
    handleLogOut: () => void;
    isCheckingAuth: boolean; 
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [login, setLogin] = useState(false);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true); 
    const router = useRouter();

    useEffect(() => {
        const userLogin = localStorage.getItem("oddsCraftToken");
        if (userLogin) {
            setLogin(true);
        }
        setIsCheckingAuth(false); 
    }, []);

    const handleLogOut = () => {
        localStorage.removeItem("oddsCraftToken");
        setLogin(false);
        router.push("/");
    };

    return (
        <AuthContext.Provider value={{ login, setLogin, handleLogOut, isCheckingAuth }}> 
            {children}
        </AuthContext.Provider>
    );
};