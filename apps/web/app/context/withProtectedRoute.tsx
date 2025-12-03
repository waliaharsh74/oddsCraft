'use client'

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SkeletonLoader } from "../components/Skeleton";
import { useAuthStore } from "../store/useAuthStore";
import { useShallow } from "zustand/react/shallow";

export const withProtectedRoute = (WrappedComponent: any) => {
    return (props: any) => {
        const { isAuthenticated, isLoading, initialized } = useAuthStore(useShallow((state) => ({
            isAuthenticated: state.isAuthenticated,
            isLoading: state.isLoading,
            initialized: state.initialized,
        })))
        const initialize = useAuthStore((state) => state.initialize)
        const router = useRouter();

        useEffect(() => {
            initialize()
        }, [initialize])

        useEffect(() => {
            if (initialized && !isLoading && !isAuthenticated) {
                router.replace("/signup");
            }
        }, [initialized, isAuthenticated, isLoading, router]);

        if (!initialized || isLoading) {
            return <SkeletonLoader /> 
        }

        if (!isAuthenticated) {
            return null; 
        }

        return <WrappedComponent {...props} />;
    };
};
