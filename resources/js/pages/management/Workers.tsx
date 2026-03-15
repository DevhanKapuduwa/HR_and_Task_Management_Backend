import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workerApi } from '../../api/workers';
import { User } from '../../types';
import {
    Plus, Edit2, Trash2, Search, X,
    ToggleLeft, ToggleRight, Loader2, Users
} from 'lucide-react';

const emptyForm = { name: '', email: '', password: '', employee_id: '', department: '', phone: '' };

export default function Workers() {
    const qc = useQueryClient();
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<User | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [formError, setFormError] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

    const { data: workers = [], isLoading } = useQuery({
        queryKey: ['workers'],
        queryFn: workerApi.getAll,
    });

    const createMut = useMutation({
        mutationFn: workerApi.create,
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['workers'] }); close(); },
        onError: (e: any) => setFormError(e.response?.data?.message || 'Failed to create'),
    });

    const updateMut = useMutation({
        mutationFn: ({ id, data }: { id: number; data: any }) => workerApi.update(id, data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['workers'] }); close(); },
        onError: (e: any) => setFormError(e.response?.data?.message || 'Failed to update'),
    });

    const deleteMut = useMutation({
        mutationFn: workerApi.delete,
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['workers'] }); setDeleteConfirm(null); },
    });

    const toggleMut = useMutation({
        mutationFn: workerApi.toggleStatus,
        onSuccess: () => qc.invalidateQueries({ queryKey: ['workers'] }),
    });

    const close = () => { setShowModal(false); setEditing(null); setForm(emptyForm); setFormError(''); };

    const openCreate = () => { setEditing(null); setForm(emptyForm); setFormError(''); setShowModal(true); };

    const openEdit = (w: User) => {
        setEditing(w);
        setForm({ name: w.name, email: w.email, password: '', employee_id: w.employee_id, department: w.department, phone: w.phone || '' });
        setFormError('');
        setShowModal(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setFormError('');
        if (editing) {
            const data: any = { name: form.name, email: form.email, employee_id: form.employee_id, department: form.department, phone: form.phone };
            if (form.password) data.password = form.password;
            updateMut.mutate({ id: editing.id, data });
        } else {
            if (!form.password) { setFormError('Password is required'); return; }
            createMut.mutate(form as any);
        }
    };

    const filtered = workers.filter(w =>
        w.name.toLowerCase().includes(search.toLowerCase()) ||
        w.email.toLowerCase().includes(search.toLowerCase()) ||
        w.employee_id?.toLowerCase().includes(search.toLowerCase()) ||
        w.department?.toLowerCase().includes(search.toLowerCase())
    );

    const isPending = createMut.isPending || updateMut.isPending;

    return (
        <div className="space-y-6">
            {/* ── Header ────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Users size={24} className="text-blue-400" /> Workers
                    <span className="text-sm font-normal text-gray-500 ml-2">({workers.length})</span>
                </h1>
                <button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2.5 rounded-lg flex items-center gap-2 transition">
                    <Plus size={16} /> Add Worker
                </button>
            </div>

            {/* ── Search ────────────────────────────────── */}
            <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search by name, email, ID, or department..."
                    className="w-full bg-gray-900 text-white text-sm pl-10 pr-4 py-3 rounded-xl border border-gray-800 focus:border-blue-500 focus:outline-none"
                />
                {search && (
                    <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                        <X size={14} />
                    </button>
                )}
            </div>

            {/* ── Table ─────────────────────────────────── */}
            {isLoading ? (
                <div className="flex justify-center py-16"><Loader2 className="animate-spin text-blue-400" size={28} /></div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                    {search ? 'No workers match your search' : 'No workers yet — add one above!'}
                </div>
            ) : (
                <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                                <th className="text-left px-5 py-4">Worker</th>
                                <th className="text-left px-5 py-4 hidden md:table-cell">Employee ID</th>
                                <th className="text-left px-5 py-4 hidden lg:table-cell">Department</th>
                                <th className="text-left px-5 py-4 hidden lg:table-cell">Phone</th>
                                <th className="text-center px-5 py-4">Tasks</th>
                                <th className="text-center px-5 py-4">Status</th>
                                <th className="text-right px-5 py-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                            {filtered.map(w => (
                                <tr key={w.id} className="hover:bg-gray-800/40 transition">
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${w.is_active ? 'bg-blue-600' : 'bg-gray-700 text-gray-400'}`}>
                                                {w.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-medium">{w.name}</p>
                                                <p className="text-xs text-gray-500">{w.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-5 py-4 text-gray-300 hidden md:table-cell font-mono text-xs">{w.employee_id}</td>
                                    <td className="px-5 py-4 text-gray-300 hidden lg:table-cell">{w.department}</td>
                                    <td className="px-5 py-4 text-gray-400 hidden lg:table-cell">{w.phone || '—'}</td>
                                    <td className="px-5 py-4 text-center">
                                        <span className="bg-gray-800 px-2.5 py-1 rounded-full text-xs font-medium text-gray-300">
                                            {w.tasks_count ?? 0}
                                        </span>
                                    </td>
                                    <td className="px-5 py-4 text-center">
                                        <button
                                            onClick={() => toggleMut.mutate(w.id)}
                                            title={w.is_active ? 'Deactivate' : 'Activate'}
                                            className="transition hover:scale-110"
                                        >
                                            {w.is_active
                                                ? <ToggleRight size={24} className="text-green-400" />
                                                : <ToggleLeft size={24} className="text-gray-600" />
                                            }
                                        </button>
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className="flex items-center justify-end gap-1">
                                            <button onClick={() => openEdit(w)} className="p-2 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-gray-800 transition">
                                                <Edit2 size={15} />
                                            </button>
                                            <button onClick={() => setDeleteConfirm(w.id)} className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-gray-800 transition">
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── Create / Edit Modal ───────────────────── */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={close}>
                    <div className="bg-gray-900 rounded-2xl border border-gray-800 w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b border-gray-800">
                            <h3 className="text-lg font-bold">{editing ? 'Edit Worker' : 'Add Worker'}</h3>
                            <button onClick={close} className="text-gray-400 hover:text-white transition"><X size={20} /></button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-5 space-y-4">
                            {formError && (
                                <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-2.5 rounded-lg text-sm">{formError}</div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-gray-400 text-xs mb-1">Name *</label>
                                    <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                                        className="w-full bg-gray-800 text-white text-sm px-3 py-2.5 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none" />
                                </div>
                                <div>
                                    <label className="block text-gray-400 text-xs mb-1">Employee ID *</label>
                                    <input required value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })}
                                        className="w-full bg-gray-800 text-white text-sm px-3 py-2.5 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-gray-400 text-xs mb-1">Email *</label>
                                <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                                    className="w-full bg-gray-800 text-white text-sm px-3 py-2.5 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none" />
                            </div>

                            <div>
                                <label className="block text-gray-400 text-xs mb-1">Password {editing ? '(leave blank to keep)' : '*'}</label>
                                <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                                    {...(!editing && { required: true })}
                                    className="w-full bg-gray-800 text-white text-sm px-3 py-2.5 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-gray-400 text-xs mb-1">Department *</label>
                                    <input required value={form.department} onChange={e => setForm({ ...form, department: e.target.value })}
                                        className="w-full bg-gray-800 text-white text-sm px-3 py-2.5 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none" />
                                </div>
                                <div>
                                    <label className="block text-gray-400 text-xs mb-1">Phone</label>
                                    <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                                        className="w-full bg-gray-800 text-white text-sm px-3 py-2.5 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none" />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={close} className="px-4 py-2.5 text-sm text-gray-400 hover:text-white transition">Cancel</button>
                                <button type="submit" disabled={isPending}
                                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm px-6 py-2.5 rounded-lg transition flex items-center gap-2">
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
                        <Trash2 size={32} className="text-red-400 mx-auto mb-3" />
                        <h3 className="text-lg font-bold mb-1">Delete Worker?</h3>
                        <p className="text-gray-400 text-sm mb-5">This action cannot be undone. All related tasks and time logs will also be removed.</p>
                        <div className="flex gap-3 justify-center">
                            <button onClick={() => setDeleteConfirm(null)} className="px-5 py-2.5 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg transition">Cancel</button>
                            <button
                                onClick={() => deleteMut.mutate(deleteConfirm)}
                                disabled={deleteMut.isPending}
                                className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm px-5 py-2.5 rounded-lg transition flex items-center gap-2">
                                {deleteMut.isPending && <Loader2 size={14} className="animate-spin" />}
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}