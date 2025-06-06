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
        await axios.post(`${ API_BASE }/api/v1/admin/event/${id}`, { status: 'CLOSED' }, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        setEvents(e => e.map(ev => ev.id === id ? { ...ev, status: 'CLOSED' } : ev));
    }

    return (
        <div className="px-6 text-white py-32 space-y-6 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-800">
            <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-500 rounded-full blur-3xl opacity-30 animate-pulse"></div>
            <div className="absolute -bottom-32 -right-32 w-[28rem] h-[28rem] bg-fuchsia-500 rounded-full blur-3xl opacity-20 animate-pulse"></div>
            <Card className="max-w-xl p-4">
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

            <Card className='p-4'>
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
                                            <Button size="sm" variant="outline"
                                            className=''
                                             onClick={() => close(ev.id)}>Close</Button>}
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
