'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/card';
import { Badge } from '@repo/ui/components/badge';
import { Button } from '@repo/ui/components/button';
import { Input } from '@repo/ui/components/input';
import { Label } from '@repo/ui/components/label';
import { AdminEventDetailShimmer } from '@/app/components/Shimmers';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@repo/ui/components/select';
import apiClient from '../../../lib/api-client';
import { withProtectedRoute } from '../../../context/withProtectedRoute';
import { adminProtectedRoute } from '../../../context/adminProtectedRoute';
import { useAuthStore } from '../../../store/useAuthStore';
import { useShallow } from 'zustand/react/shallow';

type EventStatus = 'OPEN' | 'CLOSED' | 'SETTLED';
type EventOutcome = 'YES' | 'NO' | 'VOID' | 'DISPUTED';

type EventDetail = {
    id: string;
    title: string;
    description?: string | null;
    startsAt?: string;
    endsAt: string;
    status: EventStatus;
    outcome?: EventOutcome | null;
    createdAt?: string;
    updatedAt?: string;
};

const toDateTimeLocal = (value?: string | null) => value ? new Date(value).toISOString().slice(0, 16) : '';
const formatDateTime = (value?: string | null) => value ? new Date(value).toLocaleString() : '—';

function AdminEventDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const { user } = useAuthStore(useShallow((state) => ({ user: state.user })));
    const isAdmin = user?.role === 'ADMIN';

    const [event, setEvent] = useState<EventDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [message, setMessage] = useState('');
    const [form, setForm] = useState<{ title: string; description: string; endsAt: string; status: EventStatus | ''; outcome: EventOutcome | '' }>({
        title: '',
        description: '',
        endsAt: '',
        status: '',
        outcome: '',
    });

    const statusTone = useMemo(() => ({
        OPEN: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50',
        CLOSED: 'bg-amber-500/20 text-amber-200 border border-amber-500/50',
        SETTLED: 'bg-sky-500/20 text-sky-200 border border-sky-500/50',
    }), []);

    useEffect(() => {
        if (!id) return;
        const fetchEvent = async () => {
            setLoading(true);
            setMessage('');
            try {
                const { data } = await apiClient.get<EventDetail[]>(`/events?id=${id}`);
                const detail = data[0];
                if (!detail) {
                    setMessage('Event not found.');
                    setEvent(null);
                    return;
                }
                setEvent(detail);
                setForm({
                    title: detail.title,
                    description: detail.description ?? '',
                    endsAt: toDateTimeLocal(detail.endsAt),
                    status: detail.status,
                    outcome: detail.outcome ?? '',
                });
            } catch (error: any) {
                setMessage(error?.response?.data?.error || 'Could not load event.');
            } finally {
                setLoading(false);
            }
        };
        fetchEvent();
    }, [id]);

    const handleUpdate = async () => {
        if (!event) return;
        if (!isAdmin) {
            setMessage('Only admins can update events.');
            return;
        }

        const payload: Partial<Omit<EventDetail, 'id'>> & { endsAt?: Date } = {};
        if (form.title && form.title !== event.title) payload.title = form.title;
        if ((form.description ?? '') !== (event.description ?? '')) payload.description = form.description;
        if (form.endsAt && form.endsAt !== toDateTimeLocal(event.endsAt)) payload.endsAt = new Date(form.endsAt);
        if (form.status && form.status !== event.status) payload.status = form.status;
        if (form.outcome && form.outcome !== event.outcome) payload.outcome = form.outcome;

        if (!Object.keys(payload).length) {
            setMessage('No changes to save.');
            return;
        }

        setSaving(true);
        setMessage('');
        try {
            const { data } = await apiClient.put<EventDetail>(`/admin/event/${event.id}`, payload);
            setEvent(data);
            setForm({
                title: data.title,
                description: data.description ?? '',
                endsAt: toDateTimeLocal(data.endsAt),
                status: data.status,
                outcome: data.outcome ?? '',
            });
            setMessage('Event updated successfully.');
        } catch (error: any) {
            setMessage(error?.response?.data?.error || 'Failed to update event.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!event || !isAdmin) return;
        const confirmed = window.confirm('Delete this event? This cannot be undone.');
        if (!confirmed) return;
        setDeleting(true);
        setMessage('');
        try {
            await apiClient.delete(`/admin/event/${event.id}`);
            setMessage('Event deleted.');
            router.push('/admin/events');
        } catch (error: any) {
            setMessage(error?.response?.data?.error || 'Failed to delete event.');
        } finally {
            setDeleting(false);
        }
    };

    if (loading) {
        return <AdminEventDetailShimmer />;
    }

    if (!event) {
        return (
            <div className="relative min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-800 text-zinc-100 overflow-hidden px-6 py-24">
                <div className="absolute -top-40 -left-40 w-80 h-80 bg-indigo-500 rounded-full blur-3xl opacity-30 animate-pulse" />
                <div className="absolute lg:-bottom-10 lg:-right-32 bottom-4 right-4 w-[14rem] h-[14rem] bg-fuchsia-500 rounded-full blur-3xl opacity-20 animate-pulse" />
                <div className="max-w-3xl mx-auto space-y-6">
                    <Card className="bg-zinc-900/60 ring-1 ring-zinc-700">
                        <CardContent className="p-6 flex flex-col gap-4">
                            <p className="text-lg font-semibold">Event not found.</p>
                            <div className="flex gap-3">
                                <Button variant="outline" className="text-white border-zinc-700" onClick={() => router.back()}>
                                    Go back
                                </Button>
                                <Link href="/admin/events">
                                    <Button variant="glassy" >Back to events</Button>
                                </Link>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="relative min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-800 text-zinc-100 overflow-hidden px-6 py-24">
            <div className="absolute -top-40 -left-40 w-80 h-80 bg-indigo-500 rounded-full blur-3xl opacity-30 animate-pulse" />
            <div className="absolute lg:-bottom-10 lg:-right-32 bottom-4 right-4 w-[14rem] h-[14rem] bg-fuchsia-500 rounded-full blur-3xl opacity-20 animate-pulse" />

            <div className="relative z-10 max-w-5xl mx-auto space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-2">
                        <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Admin / Event</p>
                        <h1 className="text-3xl font-bold tracking-tight text-white">{event.title}</h1>
                        <div className="flex items-center gap-2 text-sm text-zinc-300">
                            <Badge className={statusTone[event.status] || ''}>{event.status}</Badge>
                            <span className="text-zinc-400">Ends {formatDateTime(event.endsAt)}</span>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <Button variant="outline" className="text-black border-zinc-700" onClick={() => router.push('/admin/events')}>
                            Back to events
                        </Button>
                        {isAdmin && (
                            <Button variant="glassy" onClick={() => setForm((f) => ({ ...f, title: event.title, description: event.description ?? '', endsAt: toDateTimeLocal(event.endsAt), status: event.status, outcome: event.outcome ?? '' }))}>
                                Reset form
                            </Button>
                        )}
                    </div>
                </div>

                <Card className="bg-zinc-900/60 ring-1 ring-zinc-700">
                    <CardHeader>
                        <CardTitle className="text-xl">Event details</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4 text-sm text-zinc-300">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1">
                                <p className="text-xs text-zinc-500">Starts at</p>
                                <p className="font-medium">{formatDateTime(event.startsAt)}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs text-zinc-500">Ends at</p>
                                <p className="font-medium">{formatDateTime(event.endsAt)}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs text-zinc-500">Outcome</p>
                                <p className="font-medium">{event.outcome || 'Pending'}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs text-zinc-500">Created</p>
                                <p className="font-medium">{formatDateTime(event.createdAt)}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs text-zinc-500">Updated</p>
                                <p className="font-medium">{formatDateTime(event.updatedAt)}</p>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <p className="text-xs text-zinc-500">Description</p>
                            <p className="leading-relaxed">{event.description || 'No description provided.'}</p>
                        </div>
                    </CardContent>
                </Card>

                {isAdmin && (
                    <Card className="bg-zinc-900/60 ring-1 ring-zinc-700">
                        <CardHeader>
                            <CardTitle className="text-xl">Edit event</CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-5">
                            <div className="space-y-2">
                                <Label className="text-zinc-300">Title</Label>
                                <Input
                                    className="text-black"
                                    value={form.title}
                                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                                    placeholder="Event title"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-zinc-300">Description</Label>
                                <textarea
                                    className="w-full rounded-md border border-zinc-700 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/40"
                                    rows={4}
                                    value={form.description}
                                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                                    placeholder="Add more context for this event"
                                />
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label className="text-zinc-300">Ends at</Label>
                                    <Input
                                        className="text-black"
                                        type="datetime-local"
                                        value={form.endsAt}
                                        onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-zinc-300">Status</Label>
                                    <Select value={form.status} onValueChange={(value) => setForm((f) => ({ ...f, status: value as EventStatus }))}>
                                        <SelectTrigger className="w-full bg-black/40 border border-zinc-700 text-white">
                                            <SelectValue placeholder="Select status" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-zinc-900 text-white border border-zinc-700">
                                            <SelectItem value="OPEN">OPEN</SelectItem>
                                            <SelectItem value="CLOSED">CLOSED</SelectItem>
                                            <SelectItem value="SETTLED">SETTLED</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-zinc-300">Outcome</Label>
                                    <Select value={form.outcome} onValueChange={(value) => setForm((f) => ({ ...f, outcome: value as EventOutcome }))}>
                                        <SelectTrigger className="w-full bg-black/40 border border-zinc-700 text-white">
                                            <SelectValue placeholder="Select outcome" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-zinc-900 text-white border border-zinc-700">
                                            <SelectItem value="YES">YES</SelectItem>
                                            <SelectItem value="NO">NO</SelectItem>
                                            <SelectItem value="VOID">VOID</SelectItem>
                                            <SelectItem value="DISPUTED">DISPUTED</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                                {message && (
                                    <p className="text-sm text-zinc-200">{message}</p>
                                )}
                                <div className="flex flex-wrap gap-3">
                                    <Button onClick={handleUpdate} disabled={saving || deleting} variant="glassy">
                                        {saving ? 'Saving...' : 'Save changes'}
                                    </Button>
                                    <Button onClick={handleDelete} disabled={deleting || saving} variant="destructive">
                                        {deleting ? 'Deleting...' : 'Delete event'}
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}

export default withProtectedRoute(
    adminProtectedRoute(AdminEventDetailPage),
    <AdminEventDetailShimmer />
);
