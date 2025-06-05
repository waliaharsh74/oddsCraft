'use client';
import { useContext, useEffect, useState } from 'react';
import { z } from 'zod';
import { Card, CardHeader, CardTitle, CardContent } from '@repo/ui/components/card';
import { Button } from '@repo/ui/components/button';
import { Input } from '@repo/ui/components/input';
import axios from 'axios';

type Event = { id: string; title: string; endsAt: string; status: 'OPEN' | 'CLOSED' | 'SETTLED' };

const formSchema = z.object({
    title: z.string().min(5),
    endsAt: z.string().datetime(),
});

export default function AdminEvents() {

    const [events, setEvents] = useState<Event[]>([]);
    const [form, setForm] = useState({ title: '', endsAt: '' });
    const [msg, setMsg] = useState('');
    const [token,setToken]=useState<string|null>(null);
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

    useEffect(() => {
        const fetchData=async()=>{
            const {data}=await axios.get(`${API_BASE}/api/v1/admin/event`,{
                headers:{
                    Authorization: `Bearer ${userToken}`
                }
            })
            setEvents(data)
        }
        const userToken=localStorage.getItem('oddsCraftToken')
        setToken(userToken)
        fetchData()
    },[]);

    async function create() {
        // const ok = formSchema.safeParse(form);
        // if (!ok.success) { setMsg('fill both fields'); return; }
        const { data } = await axios.post(`${ API_BASE }/api/v1/admin/event`, { ...form, endsAt: new Date(form.endsAt) }, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        setEvents(e => [data, ...e]); setForm({ title: '', endsAt: '' });
    }

    async function close(id: string) {
        await axios.patch(`${ API_BASE }/api/v1/admin/event/${id}`, { status: 'CLOSED' }, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
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
