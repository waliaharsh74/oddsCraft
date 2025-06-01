"use client"

export const SkeletonLoader = () => {
    return (
        <div className="flex mt-16 h-screen w-full items-center justify-center bg-[#1a1a1a]">

            <div className="absolute  text-xl font-semibold text-gray-300 animate-pulse">
                Connecting to OddsCraft...
            </div>
        </div>
    );
};