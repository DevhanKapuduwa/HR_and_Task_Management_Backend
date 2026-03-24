import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { leaveApi } from '../../api/leave';
import { Loader2, CheckCircle2, XCircle, Inbox } from 'lucide-react';

type InboxItem = {
    id: number;
    leave_request_id: number;
    step_index: number;
    required_role: string;
    action: 'approved' | 'rejected' | null;
    comment: string | null;
    acted_at: string | null;
    leave_request?: any;
    leaveRequest?: any;
};

export default function LeaveApprovals() {
    const qc = useQueryClient();
    const [comment, setComment] = useState<Record<number, string>>({});
    const [error, setError] = useState('');

    const { data: inbox = [], isLoading } = useQuery<InboxItem[]>({
        queryKey: ['leave-inbox'],
        queryFn: leaveApi.inbox as any,
    });

    const actMut = useMutation({
        mutationFn: ({ requestId, action }: { requestId: number; action: 'approved' | 'rejected' }) =>
            leaveApi.act(requestId, { action, comment: comment[requestId] || null }),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['leave-inbox'] }); setError(''); },
        onError: (e: any) => setError(e.response?.data?.message || 'Failed to act on request'),
    });

    const rows = useMemo(() => inbox.map(i => {
        const req = i.leaveRequest ?? i.leave_request;
        return { item: i, req };
    }), [inbox]);

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold flex items-center gap-2">
                <Inbox size={22} className="text-blue-400" /> Leave approvals
            </h1>

            {error && (
                <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-3 rounded-lg text-sm">
                    {error}
                </div>
            )}

            {isLoading ? (
                <div className="flex justify-center py-16"><Loader2 className="animate-spin text-blue-400" size={28} /></div>
            ) : rows.length === 0 ? (
                <div className="text-center py-16 text-gray-500">No pending approvals</div>
            ) : (
                <div className="space-y-3">
                    {rows.map(({ item, req }) => (
                        <div key={item.id} className="bg-gray-900 rounded-xl border border-gray-800 p-5">
                            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                                <div className="min-w-0">
                                    <div className="text-sm text-gray-400">Step {item.step_index + 1} · Role: {item.required_role}</div>
                                    <div className="text-lg font-bold text-white mt-1">
                                        {req?.user?.name ?? 'Worker'} — {req?.leave_type?.name ?? req?.leaveType?.name ?? 'Leave'}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        {req?.start_at} → {req?.end_at} · {req?.duration_hours}h
                                    </div>
                                    {req?.reason && <div className="text-gray-400 text-sm mt-2">{req.reason}</div>}
                                </div>

                                <div className="flex-shrink-0 w-full md:w-80 space-y-2">
                                    <input
                                        value={comment[req?.id] ?? ''}
                                        onChange={(e) => setComment(prev => ({ ...prev, [req.id]: e.target.value }))}
                                        placeholder="Optional comment"
                                        className="w-full bg-gray-800 text-gray-200 text-sm px-3 py-2.5 rounded-lg border border-gray-700 focus:outline-none focus:border-blue-500"
                                    />
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => actMut.mutate({ requestId: req.id, action: 'approved' })}
                                            disabled={actMut.isPending}
                                            className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm px-4 py-2.5 rounded-lg flex items-center justify-center gap-2"
                                        >
                                            {actMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Approve
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => actMut.mutate({ requestId: req.id, action: 'rejected' })}
                                            disabled={actMut.isPending}
                                            className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm px-4 py-2.5 rounded-lg flex items-center justify-center gap-2"
                                        >
                                            {actMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />} Reject
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

