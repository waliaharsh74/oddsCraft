'use client';
import { useContext, useEffect, useState } from 'react';
import { z } from 'zod';
import { Card, CardHeader, CardTitle, CardContent } from '@repo/ui/components/card';
import { Button } from '@repo/ui/components/button';
import { Input } from '@repo/ui/components/input';
import axios from 'axios';
import { AuthContext } from '@/app/context/AuthContext';

type Event = { id: string; title: string; endsAt: string; status: 'OPEN' | 'CLOSED' | 'SETTLED' };

const formSchema = z.object({
    title: z.string().min(5),
    endsAt: z.string().datetime(),          
});

export default function AdminEvents() {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

    const api = axios.create({ baseURL: `${API_BASE}/api/v1` });

    function setToken() {
        const context = useContext(AuthContext);
        if (!context) {
            return null;
        }
        const { userToken } = context;
        const token = userToken
        if (token) {

            api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
        } else {


            delete api.defaults.headers.common["Authorization"];
        }
    }

    setToken();
    const [events, setEvents] = useState<Event[]>([]);
    const [form, setForm] = useState({ title: '', endsAt: '' });
    const [msg, setMsg] = useState('');

    /* fetch table */
    useEffect(() => { api.get('/admin/events').then(r => setEvents(r.data)); }, []);

    async function create() {
        const ok = formSchema.safeParse(form);
        if (!ok.success) { setMsg('fill both fields'); return; }
        const { data } = await api.post('/admin/events', { ...form, endsAt: new Date(form.endsAt) });
        setEvents(e => [data, ...e]); setForm({ title: '', endsAt: '' });
    }

    async function close(id: string) {
        await api.patch(`/admin/events/${id}`, { status: 'CLOSED' });
        setEvents(e => e.map(ev => ev.id === id ? { ...ev, status: 'CLOSED' } : ev));
    }

    return (
        <div className="p-6 space-y-6">
            {/* Create */}
            <Card className="max-w-xl">
                <CardHeader><CardTitle>Create Event</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <Input placeholder="Title" value={form.title}
                        onChange={e => setForm({ ...form, title: e.target.value })} />
                    <Input type="datetime-local" value={form.endsAt}
                        onChange={e => setForm({ ...form, endsAt: e.target.value })} />
                    <Button onClick={create}>Create</Button>
                    {msg && <p className="text-xs">{msg}</p>}
                </CardContent>
            </Card>

            {/* Table */}
            <Card>
                <CardHeader><CardTitle>Events</CardTitle></CardHeader>
                <CardContent className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead><tr className="text-zinc-400">
                            <th className="text-left p-2">Title</th>
                            <th className="p-2">Ends</th><th className="p-2">Status</th><th></th></tr></thead>
                        <tbody>
                            {events.map(ev => (
                                <tr key={ev.id} className="border-t border-zinc-700">
                                    <td className="p-2">{ev.title}</td>
                                    <td className="p-2">{new Date(ev.endsAt).toLocaleString()}</td>
                                    <td className="p-2">{ev.status}</td>
                                    <td className="p-2">
                                        {ev.status === 'OPEN' &&
                                            <Button size="sm" variant="outline" onClick={() => close(ev.id)}>Close</Button>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </CardContent>
            </Card>
        </div>
    );
}
