import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, ClipboardList, Loader2, Send } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { leaveApi } from '../../api/leave';
import type { LeaveBalance, LeaveRequest, LeaveType } from '../../types';

const fmt = (d: string) => new Date(d).toLocaleString();

export default function Leave() {
    const qc = useQueryClient();
    const [formError, setFormError] = useState('');
    const [form, setForm] = useState({
        leave_type_id: '',
        start_at: '',
        end_at: '',
        duration_hours: '8',
        reason: '',
    });

    const { data: balances = [], isLoading: loadingBalances } = useQuery<LeaveBalance[]>({
        queryKey: ['leave-balances'],
        queryFn: leaveApi.myBalances,
    });

    const { data: types = [], isLoading: loadingTypes } = useQuery<LeaveType[]>({
        queryKey: ['leave-types'],
        queryFn: leaveApi.workerTypes,
    });

    const { data: requests = [], isLoading: loadingRequests } = useQuery<LeaveRequest[]>({
        queryKey: ['leave-requests'],
        queryFn: leaveApi.myRequests,
    });

    const createMut = useMutation({
        mutationFn: () => leaveApi.createRequest({
            leave_type_id: Number(form.leave_type_id),
            start_at: form.start_at,
            end_at: form.end_at,
            duration_hours: Number(form.duration_hours),
            reason: form.reason || null,
        }),
        onSuccess: () => {
            setFormError('');
            setForm({ leave_type_id: '', start_at: '', end_at: '', duration_hours: '8', reason: '' });
            qc.invalidateQueries({ queryKey: ['leave-requests'] });
            qc.invalidateQueries({ queryKey: ['leave-balances'] });
        },
        onError: (e: any) => setFormError(e.response?.data?.message || 'Failed to submit leave request'),
    });

    const balanceByType = useMemo(() => {
        const map: Record<number, LeaveBalance> = {};
        for (const b of balances) map[b.leave_type_id] = b;
        return map;
    }, [balances]);

    const getBalanceTypeName = (b: LeaveBalance) =>
        b.leaveType?.name ?? b.leave_type?.name ?? `Type #${b.leave_type_id}`;

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold flex items-center gap-2">
                <ClipboardList size={22} className="text-green-400" /> Leave
            </h1>

            {/* Balances */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
                <div className="text-sm font-semibold text-white mb-3">My leave balances (hours)</div>
                {loadingBalances ? (
                    <div className="flex items-center gap-2 text-gray-400 text-sm"><Loader2 className="animate-spin" size={16} /> Loading…</div>
                ) : balances.length === 0 ? (
                    <div className="text-gray-500 text-sm">No balances yet.</div>
                ) : (
                    <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                        {balances.map(b => (
                            <div key={b.id} className="bg-gray-950/40 border border-gray-800 rounded-xl p-3">
                                <div className="text-xs text-gray-500">{getBalanceTypeName(b)}</div>
                                <div className="mt-1 flex items-baseline gap-2">
                                    <div className="text-lg font-bold text-white">{b.entitled_hours - b.used_hours}</div>
                                    <div className="text-xs text-gray-500">remaining</div>
                                </div>
                                <div className="text-xs text-gray-600 mt-1">{b.used_hours} used / {b.entitled_hours} entitled</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Request form */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
                <div className="text-sm font-semibold text-white mb-3">Apply for leave</div>
                {formError && (
                    <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-3 rounded-lg text-sm mb-4">
                        {formError}
                    </div>
                )}

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        setFormError('');
                        createMut.mutate();
                    }}
                    className="space-y-4"
                >
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-gray-400 text-xs mb-1">Leave type *</label>
                            <select
                                required
                                value={form.leave_type_id}
                                onChange={(e) => setForm({ ...form, leave_type_id: e.target.value })}
                                className="w-full bg-gray-800 text-gray-200 text-sm px-3 py-2.5 rounded-lg border border-gray-700 focus:outline-none focus:border-green-500"
                            >
                                <option value="">Select</option>
                                {loadingTypes ? (
                                    <option>Loading…</option>
                                ) : (
                                    types.filter(t => t.is_active).map(t => (
                                        <option key={t.id} value={t.id}>
                                            {t.name} ({(balanceByType[t.id]?.entitled_hours ?? t.yearly_entitlement_hours) - (balanceByType[t.id]?.used_hours ?? 0)}h left)
                                        </option>
                                    ))
                                )}
                            </select>
                        </div>
                        <div>
                            <label className="block text-gray-400 text-xs mb-1">Duration (hours) *</label>
                            <input
                                type="number"
                                min={1}
                                required
                                value={form.duration_hours}
                                onChange={(e) => setForm({ ...form, duration_hours: e.target.value })}
                                className="w-full bg-gray-800 text-gray-200 text-sm px-3 py-2.5 rounded-lg border border-gray-700 focus:outline-none focus:border-green-500"
                            />
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-gray-400 text-xs mb-1">Start *</label>
                            <input
                                type="datetime-local"
                                required
                                value={form.start_at}
                                onChange={(e) => setForm({ ...form, start_at: e.target.value })}
                                className="w-full bg-gray-800 text-gray-200 text-sm px-3 py-2.5 rounded-lg border border-gray-700 focus:outline-none focus:border-green-500"
                            />
                        </div>
                        <div>
                            <label className="block text-gray-400 text-xs mb-1">End *</label>
                            <input
                                type="datetime-local"
                                required
                                value={form.end_at}
                                onChange={(e) => setForm({ ...form, end_at: e.target.value })}
                                className="w-full bg-gray-800 text-gray-200 text-sm px-3 py-2.5 rounded-lg border border-gray-700 focus:outline-none focus:border-green-500"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-gray-400 text-xs mb-1">Reason</label>
                        <textarea
                            rows={3}
                            value={form.reason}
                            onChange={(e) => setForm({ ...form, reason: e.target.value })}
                            className="w-full bg-gray-800 text-gray-200 text-sm px-3 py-2.5 rounded-lg border border-gray-700 focus:outline-none focus:border-green-500 resize-none"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={createMut.isPending}
                        className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm px-4 py-2.5 rounded-lg flex items-center gap-2 transition"
                    >
                        {createMut.isPending ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                        Submit request
                    </button>
                </form>
            </div>

            {/* Requests */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
                <div className="text-sm font-semibold text-white mb-3">My requests</div>
                {loadingRequests ? (
                    <div className="flex items-center gap-2 text-gray-400 text-sm"><Loader2 className="animate-spin" size={16} /> Loading…</div>
                ) : requests.length === 0 ? (
                    <div className="text-gray-500 text-sm">No requests yet.</div>
                ) : (
                    <div className="space-y-3">
                        {requests.map(r => (
                            <div key={r.id} className="bg-gray-950/40 border border-gray-800 rounded-xl p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="font-semibold text-white">
                                            {r.leaveType?.name ?? r.leave_type?.name ?? `Type #${r.leave_type_id}`}
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
                                            <span className="inline-flex items-center gap-1"><Calendar size={12} /> {fmt(r.start_at)} → {fmt(r.end_at)}</span>
                                            <span className="text-gray-600">·</span>
                                            <span>{r.duration_hours}h</span>
                                        </div>
                                        {r.reason && <div className="text-sm text-gray-400 mt-2">{r.reason}</div>}
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-full text-xs border ${
                                        r.status === 'approved'
                                            ? 'bg-green-900/30 text-green-300 border-green-800/40'
                                            : r.status === 'rejected'
                                                ? 'bg-red-900/20 text-red-300 border-red-800/30'
                                                : 'bg-yellow-900/30 text-yellow-300 border-yellow-800/30'
                                    }`}>
                                        {r.status}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

