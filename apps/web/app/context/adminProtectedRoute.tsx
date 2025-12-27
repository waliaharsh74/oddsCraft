'use client'

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../store/useAuthStore";
import { useShallow } from "zustand/react/shallow";



export const adminProtectedRoute = (WrappedComponent: any) => {
    return (props: any) => {

        
        const { user, isAuthenticated } = useAuthStore(useShallow((state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,

    })))
        
        const router = useRouter();

     

        useEffect(() => {
        if (!isAuthenticated) {
            router.replace("/signin");
            return;
        }
        if (user?.role !== 'ADMIN') {            
            router.replace("/");
            return;
        }
       
    }, [isAuthenticated, user]);

        

  

        if (!isAuthenticated || user?.role!=="ADMIN" ) {
            return null; 
        }

        return <WrappedComponent {...props} />
                  
    };
};
