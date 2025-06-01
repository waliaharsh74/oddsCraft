import { useContext, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthContext } from "./AuthContext";
import {SkeletonLoader}  from "../components/Skeleton";

export const withProtectedRoute = (WrappedComponent: any) => {
    return (props: any) => {
        const context = useContext(AuthContext);
        if (!context) {
            return null;
        }
        const { login, isCheckingAuth } = context; 
        const router = useRouter();

        useEffect(() => {
            if (!isCheckingAuth && !login) {
                router.push("/signin");
            }
        }, [login, isCheckingAuth, router]);

        if (isCheckingAuth) {
            return <SkeletonLoader /> 
        }

        if (!login) {
            return null; 
        }

        return <WrappedComponent {...props} />;
    };
};