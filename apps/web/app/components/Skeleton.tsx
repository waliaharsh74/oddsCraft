"use client"

import { Skeleton } from "@repo/ui/components/skeleton"

export const SkeletonLoader = () => {
    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#0b0c10] via-[#0f1118] to-[#0b0c10] px-6 py-12 text-white">
            <div className="w-full max-w-5xl space-y-10">
                <div className="flex flex-col items-center gap-3 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-transparent" />
                    </div>
                    {}
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-3 rounded-2xl bg-white/5 p-5 ring-1 ring-white/10 md:col-span-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-10 w-full" />
                        <div className="grid grid-cols-2 gap-3">
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-8 w-full" />
                        </div>
                        <Skeleton className="h-48 w-full" />
                    </div>
                    <div className="space-y-3 rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-11/12" />
                        <Skeleton className="h-10 w-9/12" />
                    </div>
                </div>
            </div>
        </div>
    );
};
