'use client';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { Card, CardHeader, CardTitle, CardContent } from '@repo/ui/components/card';
import { Button } from '@repo/ui/components/button';
import { Input } from '@repo/ui/components/input';
import apiClient from '../../lib/api-client';
import { useAuthStore } from '../../store/useAuthStore';
import { withProtectedRoute } from '../../context/withProtectedRoute';

type Event = { id: string; title: string; endsAt: string; status: 'OPEN' | 'CLOSED' | 'SETTLED' };

const formSchema = z.object({
    title: z.string().min(5),
    endsAt: z.string().datetime(),
});

function AdminEvents() {

    const [events, setEvents] = useState<Event[]>([]);
    const [form, setForm] = useState({ title: '', endsAt: '' });
    const [msg, setMsg] = useState('');
    const { user, isAuthenticated, initialize } = useAuthStore((state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        initialize: state.initialize,
    }))

    useEffect(() => {
        initialize()
    }, [initialize])

    useEffect(() => {
        if (!isAuthenticated) {
            setMsg('sign in to manage events');
            return;
        }
        if (user?.role !== 'ADMIN') {
            setMsg('admin access required');
            return;
        }
        const fetchData = async () => {
            try {
                const { data } = await apiClient.get(`/api/v1/admin/event`);
                setEvents(data);
            } catch {
                setMsg('could not load events');
            }
        };
        fetchData();
    }, [isAuthenticated, user]);

    async function create() {
        const ok = formSchema.safeParse(form);
        if (!ok.success) { setMsg('fill both fields'); return; }
        if (!isAuthenticated || user?.role !== 'ADMIN') { setMsg('admin access required'); return; }
        const { data } = await apiClient.post(`/api/v1/admin/event`, { ...form, endsAt: new Date(form.endsAt) });
        setEvents(e => [data, ...e]); setForm({ title: '', endsAt: '' });
    }

    async function close(id: string) {
        if (!isAuthenticated || user?.role !== 'ADMIN') { setMsg('sign in to update events'); return; }
        await apiClient.post(`/api/v1/admin/event/${id}`, { status: 'CLOSED' });
        setEvents(e => e.map(ev => ev.id === id ? { ...ev, status: 'CLOSED' } : ev));
    }

    return (
        <div className="px-6 text-white py-32 space-y-6 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-800">
            <div className="absolute -top-40 -left-40 w-80 h-80 bg-indigo-500 rounded-full blur-3xl opacity-30 animate-pulse"></div>
            <div className="absolute -bottom-32 -right-32 w-[12rem] h-[12rem] bg-fuchsia-500 rounded-full blur-3xl opacity-20 animate-pulse"></div>
            <Card className="max-w-xl p-4">
                <CardHeader><CardTitle>Create Event</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <Input className='text-black' placeholder="Title" value={form.title}
                        onChange={e => setForm({ ...form, title: e.target.value })} />
                    <Input className='text-black' type="datetime-local" value={form.endsAt}
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
                                            <Button size="sm" className='text-black' variant="outline"onClick={() => close(ev.id)}>Close</Button>}
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

export default withProtectedRoute(AdminEvents)
