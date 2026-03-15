import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { taskApi } from '../../api/tasks';
import { workerApi } from '../../api/workers';
import { Task } from '../../types';
import {
    Plus, Edit2, Trash2, X, Loader2, ClipboardList,
    Filter, Calendar, MapPin, AlertCircle
} from 'lucide-react';

const statusBadge: Record<string, string> = {
    pending: 'bg-yellow-900/40 text-yellow-400 border border-yellow-700/50',
    in_progress: 'bg-blue-900/40   text-blue-400   border border-blue-700/50',
    completed: 'bg-green-900/40  text-green-400  border border-green-700/50',
    cancelled: 'bg-red-900/40    text-red-400    border border-red-700/50',
};

const priorityBadge: Record<string, string> = {
    low: 'bg-gray-800 text-gray-400 border border-gray-700',
    medium: 'bg-yellow-900/30 text-yellow-400 border border-yellow-700/50',
    high: 'bg-red-900/30 text-red-400 border border-red-700/50',
};

const emptyForm = { title: '', description: '', worker_id: '', priority: 'medium', location: '', due_date: '' };

export default function Tasks() {
    const qc = useQueryClient();
    const [statusFilter, setStatusFilter] = useState('');
    const [priorityFilter, setPriorityFilter] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<Task | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [formError, setFormError] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

    const { data: tasks = [], isLoading } = useQuery({
        queryKey: ['tasks', statusFilter, priorityFilter],
        queryFn: () => taskApi.getAll({
            ...(statusFilter && { status: statusFilter }),
            ...(priorityFilter && { priority: priorityFilter } as any),
        }),
    });

    const { data: workers = [] } = useQuery({
        queryKey: ['workers'],
        queryFn: workerApi.getAll,
    });

    const createMut = useMutation({
        mutationFn: (data: any) => taskApi.create(data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); close(); },
        onError: (e: any) => setFormError(e.response?.data?.message || 'Failed'),
    });

    const updateMut = useMutation({
        mutationFn: ({ id, data }: { id: number; data: any }) => taskApi.update(id, data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); close(); },
        onError: (e: any) => setFormError(e.response?.data?.message || 'Failed'),
    });

    const statusMut = useMutation({
        mutationFn: ({ id, status }: { id: number; status: Task['status'] }) => taskApi.updateStatus(id, status),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
    });

    const deleteMut = useMutation({
        mutationFn: taskApi.delete,
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); setDeleteConfirm(null); },
    });

    const close = () => { setShowModal(false); setEditing(null); setForm(emptyForm); setFormError(''); };

    const openCreate = () => { setEditing(null); setForm(emptyForm); setFormError(''); setShowModal(true); };

    const openEdit = (t: Task) => {
        setEditing(t);
        setForm({
            title: t.title, description: t.description || '', worker_id: String(t.assigned_to),
            priority: t.priority, location: t.location || '', due_date: t.due_date ? t.due_date.slice(0, 16) : '',
        });
        setFormError('');
        setShowModal(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setFormError('');
        const payload: any = {
            title: form.title, description: form.description || null,
            worker_id: Number(form.worker_id), priority: form.priority,
            location: form.location || null, due_date: form.due_date || null,
        };
        if (editing) {
            updateMut.mutate({ id: editing.id, data: payload });
        } else {
            createMut.mutate(payload);
        }
    };

    const isPending = createMut.isPending || updateMut.isPending;

    const fmtDate = (d: string | null) => {
        if (!d) return '—';
        return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
        <div className="space-y-6">
            {/* ── Header ────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <ClipboardList size={24} className="text-blue-400" /> Tasks
                    <span className="text-sm font-normal text-gray-500 ml-2">({tasks.length})</span>
                </h1>
                <button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2.5 rounded-lg flex items-center gap-2 transition">
                    <Plus size={16} /> New Task
                </button>
            </div>

            {/* ── Filters ───────────────────────────────── */}
            <div className="flex flex-wrap gap-3 items-center">
                <Filter size={16} className="text-gray-400" />
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                    className="bg-gray-900 text-gray-300 text-sm px-3 py-2 rounded-lg border border-gray-800 focus:outline-none focus:border-blue-500">
                    <option value="">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                </select>
                <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
                    className="bg-gray-900 text-gray-300 text-sm px-3 py-2 rounded-lg border border-gray-800 focus:outline-none focus:border-blue-500">
                    <option value="">All Priorities</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                </select>
                {(statusFilter || priorityFilter) && (
                    <button onClick={() => { setStatusFilter(''); setPriorityFilter(''); }}
                        className="text-xs text-gray-400 hover:text-white transition">Clear</button>
                )}
            </div>

            {/* ── Task Cards ────────────────────────────── */}
            {isLoading ? (
                <div className="flex justify-center py-16"><Loader2 className="animate-spin text-blue-400" size={28} /></div>
            ) : tasks.length === 0 ? (
                <div className="text-center py-16 text-gray-500">No tasks found</div>
            ) : (
                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {tasks.map(t => (
                        <div key={t.id} className="bg-gray-900 rounded-xl border border-gray-800 p-5 flex flex-col hover:border-gray-700 transition group">
                            <div className="flex items-start justify-between gap-2 mb-3">
                                <h3 className="font-semibold text-white leading-snug">{t.title}</h3>
                                <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition">
                                    <button onClick={() => openEdit(t)} className="p-1.5 rounded text-gray-400 hover:text-blue-400 hover:bg-gray-800"><Edit2 size={13} /></button>
                                    <button onClick={() => setDeleteConfirm(t.id)} className="p-1.5 rounded text-gray-400 hover:text-red-400 hover:bg-gray-800"><Trash2 size={13} /></button>
                                </div>
                            </div>

                            {t.description && <p className="text-gray-400 text-xs mb-3 line-clamp-2">{t.description}</p>}

                            <div className="flex flex-wrap gap-2 mb-3">
                                <span className={`px-2 py-0.5 rounded-full text-xs ${statusBadge[t.status]}`}>{t.status.replace('_', ' ')}</span>
                                <span className={`px-2 py-0.5 rounded-full text-xs ${priorityBadge[t.priority]}`}>{t.priority}</span>
                            </div>

                            <div className="space-y-1.5 text-xs text-gray-400 mt-auto">
                                <div className="flex items-center gap-1.5">
                                    <span className="w-5 h-5 bg-blue-600/30 rounded-full flex items-center justify-center text-[10px] font-bold text-blue-400">
                                        {t.worker?.name?.charAt(0) || '?'}
                                    </span>
                                    {t.worker?.name || 'Unassigned'} <span className="text-gray-600">#{t.worker?.employee_id}</span>
                                </div>
                                {t.location && <div className="flex items-center gap-1.5"><MapPin size={12} className="text-gray-500" /> {t.location}</div>}
                                {t.due_date && <div className="flex items-center gap-1.5"><Calendar size={12} className="text-gray-500" /> Due {fmtDate(t.due_date)}</div>}
                            </div>

                            {/* Quick status change */}
                            <div className="mt-4 pt-3 border-t border-gray-800">
                                <select
                                    value={t.status}
                                    onChange={e => statusMut.mutate({ id: t.id, status: e.target.value as Task['status'] })}
                                    className="w-full bg-gray-800 text-gray-300 text-xs px-2 py-1.5 rounded border border-gray-700 focus:outline-none focus:border-blue-500"
                                >
                                    <option value="pending">Pending</option>
                                    <option value="in_progress">In Progress</option>
                                    <option value="completed">Completed</option>
                                    <option value="cancelled">Cancelled</option>
                                </select>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Create / Edit Modal ───────────────────── */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={close}>
                    <div className="bg-gray-900 rounded-2xl border border-gray-800 w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b border-gray-800">
                            <h3 className="text-lg font-bold">{editing ? 'Edit Task' : 'New Task'}</h3>
                            <button onClick={close} className="text-gray-400 hover:text-white"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-5 space-y-4">
                            {formError && <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-2.5 rounded-lg text-sm">{formError}</div>}

                            <div>
                                <label className="block text-gray-400 text-xs mb-1">Title *</label>
                                <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                                    className="w-full bg-gray-800 text-white text-sm px-3 py-2.5 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none" />
                            </div>

                            <div>
                                <label className="block text-gray-400 text-xs mb-1">Description</label>
                                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                                    rows={3} className="w-full bg-gray-800 text-white text-sm px-3 py-2.5 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none resize-none" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-gray-400 text-xs mb-1">Assign to *</label>
                                    <select required value={form.worker_id} onChange={e => setForm({ ...form, worker_id: e.target.value })}
                                        className="w-full bg-gray-800 text-gray-300 text-sm px-3 py-2.5 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none">
                                        <option value="">Select worker</option>
                                        {workers.filter(w => w.is_active).map(w => (
                                            <option key={w.id} value={w.id}>{w.name} ({w.employee_id})</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-gray-400 text-xs mb-1">Priority *</label>
                                    <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}
                                        className="w-full bg-gray-800 text-gray-300 text-sm px-3 py-2.5 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none">
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-gray-400 text-xs mb-1">Location</label>
                                    <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}
                                        className="w-full bg-gray-800 text-white text-sm px-3 py-2.5 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none" />
                                </div>
                                <div>
                                    <label className="block text-gray-400 text-xs mb-1">Due Date</label>
                                    <input type="datetime-local" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })}
                                        className="w-full bg-gray-800 text-white text-sm px-3 py-2.5 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none" />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={close} className="px-4 py-2.5 text-sm text-gray-400 hover:text-white transition">Cancel</button>
                                <button type="submit" disabled={isPending}
                                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm px-6 py-2.5 rounded-lg flex items-center gap-2 transition">
                                    {isPending && <Loader2 size={14} className="animate-spin" />}
                                    {editing ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Delete Confirm ────────────────────────── */}
            {deleteConfirm !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setDeleteConfirm(null)}>
                    <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 w-full max-w-sm shadow-2xl text-center" onClick={e => e.stopPropagation()}>
                        <AlertCircle size={32} className="text-red-400 mx-auto mb-3" />
                        <h3 className="text-lg font-bold mb-1">Delete Task?</h3>
                        <p className="text-gray-400 text-sm mb-5">This will permanently remove the task and its time logs.</p>
                        <div className="flex gap-3 justify-center">
                            <button onClick={() => setDeleteConfirm(null)} className="px-5 py-2.5 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg transition">Cancel</button>
                            <button onClick={() => deleteMut.mutate(deleteConfirm)} disabled={deleteMut.isPending}
                                className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm px-5 py-2.5 rounded-lg flex items-center gap-2 transition">
                                {deleteMut.isPending && <Loader2 size={14} className="animate-spin" />} Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}