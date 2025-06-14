'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';
import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
} from '@repo/ui/components/card';
import { Button } from '@repo/ui/components/button';
import { Skeleton } from "@repo/ui/components/skeleton"


type Event = {
    id: string;
    title: string;
    endsAt: string;
    description?: string | null;
};

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function OpenEventsPage() {
    const [events, setEvents] = useState<Event[]>([]);
    const [msg, setMsg] = useState('');
    const [loading,setLoading]=useState(true);

    useEffect(() => {
        const fetchEvents = async () => {
            const token = localStorage.getItem('oddsCraftToken');
            if (!token) {
                setMsg('⚠︎ please sign in');
                setLoading(false);
                return;
            }

            try {
                const res = await axios.get<Event[]>(`${API}/api/v1/events?status=OPEN`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                setEvents(res.data);
            } catch (e: any) {
                setMsg(e.response?.data?.error || 'server');
            } finally {
                setLoading(false);
            }
        };

        fetchEvents();
    }, []);
    
    
    return (
        <div className="p-6 space-y-6 min-h-screen bg-zinc-950 text-zinc-200 py-24">
            <Card className="bg-zinc-900/60 ring-1 ring-zinc-700 p-2">
                <CardHeader>
                    <CardTitle className="text-xl">Open Events</CardTitle>
                </CardHeader>

                <CardContent className="overflow-x-auto">
                    {msg && <p className="text-sm mb-4">{msg}</p>}

                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-zinc-400">
                                <th className="text-left p-2">Event</th>
                                <th className="p-2">Ends</th>
                                <th className="p-2"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {events.map((ev) => (
                                <tr key={ev.id} className="border-t border-zinc-700">
                                    <td className="p-2">
                                        <p className="font-medium">{ev.title}</p>
                                        {ev.description && (
                                            <p className="text-xs text-zinc-400 line-clamp-2">
                                                {ev.description}
                                            </p>
                                        )}
                                    </td>
                                    <td className="p-2 whitespace-nowrap">
                                        {new Date(ev.endsAt).toLocaleString()}
                                    </td>
                                    <td className="p-2">
                                        <Link href={`/events/${ev.id}`}>
                                            <Button size="sm">Trade</Button>
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                            {loading && (
                                 <tr>
                                 <td colSpan={3} className="p-4 text-center text-zinc-500">
                                     
                                 <Skeleton className="h-[25px] w-full rounded-xl bg-zinc-500" />
                                 </td>
                                </tr>)}

                            {!loading && events.length === 0 && !msg && (
                                <tr>
                                    <td colSpan={3} className="p-4 text-center text-zinc-500">
                                        No open events right now
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </CardContent>
            </Card>
        </div>
    );
}
