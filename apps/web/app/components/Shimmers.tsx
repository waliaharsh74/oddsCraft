"use client";

import { Skeleton } from "@repo/ui/components/skeleton";

const EVENT_ROWS = [0, 1, 2, 3];
const ADMIN_ROWS = [0, 1, 2, 3, 4];

export const EventsPageShimmer = () => {
  return (
    <div className="relative min-h-screen bg-zinc-950 px-6 py-24 text-zinc-200">
      <div className="absolute -top-40 -left-40 h-60 w-120 rounded-full bg-indigo-500 blur-3xl opacity-30 animate-pulse" />
      <div className="absolute bottom-2 right-2 h-[12rem] w-[12rem] rounded-full bg-fuchsia-500 blur-3xl opacity-20 animate-pulse lg:-bottom-6 lg:-right-32" />
      <div className="relative max-w-5xl space-y-6">
        <div className="space-y-6 rounded-2xl bg-zinc-900/60 p-6 ring-1 ring-zinc-700">
          <div className="flex items-center justify-between gap-4">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-8 w-24" />
          </div>
          <div className="space-y-4">
            {EVENT_ROWS.map((row) => (
              <div
                key={`event-row-${row}`}
                className="flex items-center justify-between gap-4 rounded-xl bg-zinc-900/40 p-4 ring-1 ring-zinc-800"
              >
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                </div>
                <Skeleton className="h-9 w-20" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export const TradePageShimmer = () => {
  return (
    <div className="relative min-h-screen bg-zinc-950 px-6 py-24 text-zinc-200">
      <div className="absolute -top-40 -left-40 h-60 w-120 rounded-full bg-indigo-500 blur-3xl opacity-30 animate-pulse" />
      <div className="absolute bottom-2 right-2 h-[12rem] w-[12rem] rounded-full bg-fuchsia-500 blur-3xl opacity-20 animate-pulse lg:-bottom-6 lg:-right-32" />
      <div className="relative grid gap-4 lg:grid-cols-3">
        <div className="col-span-2 flex flex-col gap-4">
          <Skeleton className="h-40 rounded-xl bg-zinc-800/70" />
          <Skeleton className="h-32 rounded-xl bg-zinc-800/70" />
          <Skeleton className="h-72 rounded-xl bg-zinc-800/70" />
        </div>
        <Skeleton className="h-[620px] rounded-xl bg-zinc-800/70 lg:sticky lg:top-24" />
      </div>
    </div>
  );
};

export const UserPageShimmer = () => {
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-800 px-6 py-24 text-white">
      <div className="absolute -top-40 -left-40 h-80 w-80 rounded-full bg-indigo-500 blur-3xl opacity-30 animate-pulse" />
      <div className="absolute -bottom-40 -right-0 h-[12rem] w-[12rem] rounded-full bg-fuchsia-500 blur-3xl opacity-20 animate-pulse lg:-bottom-6 lg:-right-32" />
      <div className="relative grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-[260px] rounded-xl lg:col-span-1" />
        <Skeleton className="h-[260px] rounded-xl lg:col-span-2" />
        <Skeleton className="h-[320px] rounded-xl lg:col-span-3" />
      </div>
    </div>
  );
};

export const AdminEventsShimmer = () => {
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-800 px-6 py-24 text-white">
      <div className="absolute -top-40 -left-40 h-80 w-80 rounded-full bg-indigo-500 blur-3xl opacity-30 animate-pulse" />
      <div className="absolute -bottom-40 -right-0 h-[12rem] w-[12rem] rounded-full bg-fuchsia-500 blur-3xl opacity-20 animate-pulse lg:-bottom-6 lg:-right-32" />
      <div className="relative space-y-6">
        <div className="max-w-xl space-y-4 rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="space-y-4 rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
          <Skeleton className="h-5 w-24" />
          <div className="space-y-3">
            {ADMIN_ROWS.map((row) => (
              <div
                key={`admin-row-${row}`}
                className="grid items-center gap-3 rounded-xl bg-black/20 p-3 md:grid-cols-5"
              >
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-20" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export const AdminEventDetailShimmer = () => {
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-800 px-6 py-24 text-zinc-100">
      <div className="absolute -top-40 -left-40 h-80 w-80 rounded-full bg-indigo-500 blur-3xl opacity-30 animate-pulse" />
      <div className="absolute bottom-4 right-4 h-[14rem] w-[14rem] rounded-full bg-fuchsia-500 blur-3xl opacity-20 animate-pulse lg:-bottom-10 lg:-right-32" />
      <div className="relative mx-auto max-w-5xl space-y-4">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[180px] rounded-xl bg-zinc-800/70" />
        <Skeleton className="h-[260px] rounded-xl bg-zinc-800/70" />
      </div>
    </div>
  );
};

export const AuthPageShimmer = () => {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <div className="flex w-full flex-col justify-center p-6 md:p-12 lg:w-1/2">
        <div className="mx-auto w-full max-w-md space-y-8">
          <div className="space-y-3">
            <Skeleton className="h-7 w-44" />
            <Skeleton className="h-4 w-72" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
      <div className="relative hidden w-1/2 overflow-hidden bg-primary lg:block">
        <div className="absolute inset-0 bg-mesh-pattern opacity-10" />
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-indigo-500 blur-3xl opacity-30 animate-pulse" />
        <div className="absolute -bottom-32 -right-32 h-[28rem] w-[28rem] rounded-full bg-fuchsia-500 blur-3xl opacity-20 animate-pulse" />
        <div className="absolute inset-0 flex items-center justify-center p-12">
          <div className="w-full max-w-md space-y-6 text-white">
            <Skeleton className="h-16 w-16 rounded-full" />
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-4 w-72" />
            <div className="space-y-3 rounded-2xl bg-white/10 p-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-8 w-32" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
