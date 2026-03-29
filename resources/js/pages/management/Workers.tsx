import { useState, useEffect, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { workerApi } from '../../api/workers';
import { User } from '../../types';
import {
    Plus, Edit2, Trash2, Search, X,
    ToggleLeft, ToggleRight, Loader2, Users, UserCircle,
} from 'lucide-react';

const emptyMgrForm = {
    job_role: '',
    department: '',
    salary: '',
    work_location: '',
    training_hours: '',
    promotions: '',
    absenteeism: '',
    distance_from_home: '',
    manager_feedback_score: '',
};

const emptyForm = { name: '', email: '', password: '', employee_id: '', department: '', phone: '' };

export default function Workers() {
    const qc = useQueryClient();
    const { user } = useAuth();
    const canManageWorkers = user?.role === 'management';
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<User | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [formError, setFormError] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
    const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
    const [mgrForm, setMgrForm] = useState(emptyMgrForm);
    const [profileErr, setProfileErr] = useState('');

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

    const { data: profileDetail, isLoading: profileLoading } = useQuery({
        queryKey: ['worker', selectedProfileId],
        queryFn: () => workerApi.getById(selectedProfileId!),
        enabled: selectedProfileId !== null,
    });

    useEffect(() => {
        if (!profileDetail) return;
        setMgrForm({
            job_role: profileDetail.job_role ?? '',
            department: profileDetail.department ?? '',
            salary: profileDetail.salary != null && profileDetail.salary !== '' ? String(profileDetail.salary) : '',
            work_location: profileDetail.work_location ?? '',
            training_hours: profileDetail.training_hours != null ? String(profileDetail.training_hours) : '',
            promotions: profileDetail.promotions != null ? String(profileDetail.promotions) : '',
            absenteeism: profileDetail.absenteeism != null ? String(profileDetail.absenteeism) : '',
            distance_from_home: profileDetail.distance_from_home != null ? String(profileDetail.distance_from_home) : '',
            manager_feedback_score:
                profileDetail.manager_feedback_score != null && profileDetail.manager_feedback_score !== ''
                    ? String(profileDetail.manager_feedback_score)
                    : '',
        });
    }, [profileDetail]);

    const profileSaveMut = useMutation({
        mutationFn: () =>
            workerApi.update(selectedProfileId!, {
                job_role: mgrForm.job_role || undefined,
                department: mgrForm.department,
                salary: mgrForm.salary === '' ? undefined : Number(mgrForm.salary),
                work_location: mgrForm.work_location || undefined,
                training_hours: mgrForm.training_hours === '' ? undefined : Number(mgrForm.training_hours),
                promotions: mgrForm.promotions === '' ? undefined : Number(mgrForm.promotions),
                absenteeism: mgrForm.absenteeism === '' ? undefined : Number(mgrForm.absenteeism),
                distance_from_home: mgrForm.distance_from_home === '' ? undefined : Number(mgrForm.distance_from_home),
                manager_feedback_score:
                    mgrForm.manager_feedback_score === '' ? undefined : Number(mgrForm.manager_feedback_score),
            }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['worker', selectedProfileId] });
            qc.invalidateQueries({ queryKey: ['workers'] });
            setProfileErr('');
        },
        onError: (e: any) => setProfileErr(e.response?.data?.message || 'Save failed'),
    });

    const close = () => { setShowModal(false); setEditing(null); setForm(emptyForm); setFormError(''); };

    const openCreate = () => { setEditing(null); setForm(emptyForm); setFormError(''); setShowModal(true); };

    const openEdit = (w: User) => {
        setEditing(w);
        setForm({ name: w.name, email: w.email, password: '', employee_id: w.employee_id, department: w.department, phone: w.phone || '' });
        setFormError('');
        setShowModal(true);
    };

    const handleSubmit = (e: FormEvent) => {
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
                {canManageWorkers && (
                    <button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2.5 rounded-lg flex items-center gap-2 transition">
                        <Plus size={16} /> Add Worker
                    </button>
                )}
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
                                        {canManageWorkers ? (
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
                                        ) : (
                                            <span title={w.is_active ? 'Active' : 'Inactive'}>
                                                {w.is_active
                                                    ? <ToggleRight size={24} className="text-green-400/70" />
                                                    : <ToggleLeft size={24} className="text-gray-600" />
                                                }
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                type="button"
                                                title="Employee profile"
                                                onClick={() => { setSelectedProfileId(w.id); setProfileErr(''); }}
                                                className="p-2 rounded-lg text-gray-400 hover:text-cyan-400 hover:bg-gray-800 transition"
                                            >
                                                <UserCircle size={17} />
                                            </button>
                                            {canManageWorkers && (
                                                <>
                                                    <button onClick={() => openEdit(w)} className="p-2 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-gray-800 transition">
                                                        <Edit2 size={15} />
                                                    </button>
                                                    <button onClick={() => setDeleteConfirm(w.id)} className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-gray-800 transition">
                                                        <Trash2 size={15} />
                                                    </button>
                                                </>
                                            )}
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
            {/* ── Employee profile (management) ─────────── */}
            {selectedProfileId !== null && (
                <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={() => setSelectedProfileId(null)}>
                    <div
                        className="w-full max-w-xl h-full bg-gray-950 border-l border-gray-800 shadow-2xl overflow-y-auto"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="sticky top-0 bg-gray-950/95 backdrop-blur border-b border-gray-800 px-5 py-4 flex items-center justify-between z-10">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                <UserCircle size={22} className="text-cyan-400" /> Employee profile
                            </h2>
                            <button
                                type="button"
                                onClick={() => setSelectedProfileId(null)}
                                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800"
                            >
                                <X size={22} />
                            </button>
                        </div>

                        <div className="p-5 space-y-8 pb-24">
                            {profileLoading || !profileDetail ? (
                                <div className="flex justify-center py-20">
                                    <Loader2 className="animate-spin text-cyan-400" size={28} />
                                </div>
                            ) : (
                                <>
                                    <section>
                                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Identity</h3>
                                        <dl className="space-y-2 text-sm">
                                            <div className="flex justify-between gap-4">
                                                <dt className="text-gray-500">Employee ID</dt>
                                                <dd className="font-mono text-gray-200">{profileDetail.employee_id}</dd>
                                            </div>
                                            <div className="flex justify-between gap-4">
                                                <dt className="text-gray-500">Name</dt>
                                                <dd className="text-gray-200">{profileDetail.name}</dd>
                                            </div>
                                        </dl>
                                    </section>

                                    <section>
                                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                                            Employee-entered
                                        </h3>
                                        <p className="text-xs text-gray-600 mb-3">Workers update these in My Profile. Read-only here.</p>
                                        <dl className="space-y-2 text-sm">
                                            <div className="flex justify-between gap-4">
                                                <dt className="text-gray-500">Age</dt>
                                                <dd className="text-gray-200">{profileDetail.age ?? '—'}</dd>
                                            </div>
                                            <div className="flex justify-between gap-4">
                                                <dt className="text-gray-500">Gender</dt>
                                                <dd className="text-gray-200">{profileDetail.gender ?? '—'}</dd>
                                            </div>
                                            <div className="flex justify-between gap-4">
                                                <dt className="text-gray-500">Education</dt>
                                                <dd className="text-gray-200 text-right">{profileDetail.education_level ?? '—'}</dd>
                                            </div>
                                            <div className="flex justify-between gap-4">
                                                <dt className="text-gray-500">Marital status</dt>
                                                <dd className="text-gray-200">{profileDetail.marital_status ?? '—'}</dd>
                                            </div>
                                            <div className="flex justify-between gap-4">
                                                <dt className="text-gray-500">Joined date</dt>
                                                <dd className="text-gray-200">
                                                    {profileDetail.joined_date
                                                        ? String(profileDetail.joined_date).slice(0, 10)
                                                        : '—'}
                                                </dd>
                                            </div>
                                        </dl>
                                    </section>

                                    <section>
                                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                                            Calculated from activity
                                        </h3>
                                        <p className="text-xs text-gray-600 mb-3">
                                            Work–life balance uses engagement attendance. Overtime and absenteeism use 8h days, completed clock sessions, and scheduled shifts (lateness vs shift start; missed shift day = 8h shortage). Figures are per calendar month.
                                        </p>
                                        <dl className="space-y-2 text-sm">
                                            <div className="flex justify-between gap-4">
                                                <dt className="text-gray-500">Tenure</dt>
                                                <dd className="text-gray-200">{profileDetail.profile_metrics?.tenure?.label ?? '—'}</dd>
                                            </div>
                                            <div className="flex justify-between gap-4">
                                                <dt className="text-gray-500">Projects completed</dt>
                                                <dd className="text-gray-200">{profileDetail.profile_metrics?.projects_completed ?? 0}</dd>
                                            </div>
                                            <div className="flex justify-between gap-4">
                                                <dt className="text-gray-500">Hours worked (this month)</dt>
                                                <dd className="text-gray-200">{profileDetail.profile_metrics?.total_hours_worked_this_month ?? 0}</dd>
                                            </div>
                                            <div className="flex justify-between gap-4">
                                                <dt className="text-gray-500">Overtime hours (this month)</dt>
                                                <dd className="text-gray-200">{profileDetail.profile_metrics?.overtime_hours ?? 0}</dd>
                                            </div>
                                            <div className="flex justify-between gap-4">
                                                <dt className="text-gray-500">Absenteeism units (this month)</dt>
                                                <dd className="text-gray-200">{profileDetail.profile_metrics?.absenteeism_units ?? 0}</dd>
                                            </div>
                                            <div className="flex justify-between gap-4">
                                                <dt className="text-gray-500">Shortage remainder (this month, h)</dt>
                                                <dd className="text-gray-200">{profileDetail.profile_metrics?.shortage_hours_remainder ?? 0}</dd>
                                            </div>
                                            <div className="flex justify-between gap-4">
                                                <dt className="text-gray-500">Avg. monthly hours worked</dt>
                                                <dd className="text-gray-200">{profileDetail.profile_metrics?.average_monthly_hours_worked ?? 0}</dd>
                                            </div>
                                            <div className="flex justify-between gap-4">
                                                <dt className="text-gray-500">Engagement attendance %</dt>
                                                <dd className="text-gray-200">
                                                    {profileDetail.profile_metrics?.engagement_attendance_pct != null
                                                        ? `${profileDetail.profile_metrics.engagement_attendance_pct}%`
                                                        : '—'}
                                                </dd>
                                            </div>
                                            <div className="flex justify-between gap-4">
                                                <dt className="text-gray-500">Work–life balance</dt>
                                                <dd className="text-gray-200 font-medium">
                                                    {profileDetail.profile_metrics?.work_life_balance ?? '—'}
                                                </dd>
                                            </div>
                                        </dl>
                                        {profileDetail.profile_metrics?.monthly_work_stats &&
                                            profileDetail.profile_metrics.monthly_work_stats.length > 0 && (
                                            <div className="mt-4 pt-4 border-t border-gray-800">
                                                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">By month</h4>
                                                <div className="overflow-x-auto text-xs">
                                                    <table className="w-full text-left border-collapse">
                                                        <thead>
                                                            <tr className="text-gray-500 border-b border-gray-800">
                                                                <th className="py-1 pr-2">Month</th>
                                                                <th className="py-1 pr-2">Worked (h)</th>
                                                                <th className="py-1 pr-2">OT (h)</th>
                                                                <th className="py-1 pr-2">Absent. units</th>
                                                                <th className="py-1 pr-2">Short. rem. (h)</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {[...profileDetail.profile_metrics.monthly_work_stats].reverse().slice(0, 12).map((row) => (
                                                                <tr key={row.year_month} className="border-b border-gray-800/60 text-gray-300">
                                                                    <td className="py-1 pr-2 font-mono">{row.year_month}</td>
                                                                    <td className="py-1 pr-2">{row.total_hours_worked}</td>
                                                                    <td className="py-1 pr-2">{row.overtime_hours}</td>
                                                                    <td className="py-1 pr-2">{row.absenteeism_units}</td>
                                                                    <td className="py-1 pr-2">{row.shortage_hours_remainder}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </section>

                                    <section>
                                        <h3 className="text-xs font-semibold text-cyan-500/90 uppercase tracking-wider mb-3">
                                            Management fields
                                        </h3>
                                        {canManageWorkers ? (
                                            <>
                                                {profileErr && (
                                                    <div className="mb-3 bg-red-900/30 border border-red-800 text-red-300 px-3 py-2 rounded-lg text-sm">
                                                        {profileErr}
                                                    </div>
                                                )}
                                                <form
                                                    className="space-y-3"
                                                    onSubmit={e => {
                                                        e.preventDefault();
                                                        profileSaveMut.mutate();
                                                    }}
                                                >
                                                    <div>
                                                        <label className="block text-gray-500 text-xs mb-1">Job role</label>
                                                        <input
                                                            value={mgrForm.job_role}
                                                            onChange={e => setMgrForm({ ...mgrForm, job_role: e.target.value })}
                                                            className="w-full bg-gray-900 text-white text-sm px-3 py-2 rounded-lg border border-gray-800 focus:border-cyan-500 focus:outline-none"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-gray-500 text-xs mb-1">Department *</label>
                                                        <input
                                                            required
                                                            value={mgrForm.department}
                                                            onChange={e => setMgrForm({ ...mgrForm, department: e.target.value })}
                                                            className="w-full bg-gray-900 text-white text-sm px-3 py-2 rounded-lg border border-gray-800 focus:border-cyan-500 focus:outline-none"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-gray-500 text-xs mb-1">Salary</label>
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            step={0.01}
                                                            value={mgrForm.salary}
                                                            onChange={e => setMgrForm({ ...mgrForm, salary: e.target.value })}
                                                            className="w-full bg-gray-900 text-white text-sm px-3 py-2 rounded-lg border border-gray-800 focus:border-cyan-500 focus:outline-none"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-gray-500 text-xs mb-1">Work location</label>
                                                        <select
                                                            value={mgrForm.work_location}
                                                            onChange={e => setMgrForm({ ...mgrForm, work_location: e.target.value })}
                                                            className="w-full bg-gray-900 text-white text-sm px-3 py-2 rounded-lg border border-gray-800 focus:border-cyan-500 focus:outline-none"
                                                        >
                                                            <option value="">—</option>
                                                            <option value="Remote">Remote</option>
                                                            <option value="On-site">On-site</option>
                                                            <option value="Hybrid">Hybrid</option>
                                                        </select>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="block text-gray-500 text-xs mb-1">Training hours</label>
                                                            <input
                                                                type="number"
                                                                min={0}
                                                                value={mgrForm.training_hours}
                                                                onChange={e => setMgrForm({ ...mgrForm, training_hours: e.target.value })}
                                                                className="w-full bg-gray-900 text-white text-sm px-3 py-2 rounded-lg border border-gray-800 focus:border-cyan-500 focus:outline-none"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-gray-500 text-xs mb-1">Promotions</label>
                                                            <input
                                                                type="number"
                                                                min={0}
                                                                value={mgrForm.promotions}
                                                                onChange={e => setMgrForm({ ...mgrForm, promotions: e.target.value })}
                                                                className="w-full bg-gray-900 text-white text-sm px-3 py-2 rounded-lg border border-gray-800 focus:border-cyan-500 focus:outline-none"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-gray-500 text-xs mb-1">Absenteeism (days)</label>
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            value={mgrForm.absenteeism}
                                                            onChange={e => setMgrForm({ ...mgrForm, absenteeism: e.target.value })}
                                                            className="w-full bg-gray-900 text-white text-sm px-3 py-2 rounded-lg border border-gray-800 focus:border-cyan-500 focus:outline-none"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-gray-500 text-xs mb-1">Distance from home (km)</label>
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            value={mgrForm.distance_from_home}
                                                            onChange={e => setMgrForm({ ...mgrForm, distance_from_home: e.target.value })}
                                                            className="w-full bg-gray-900 text-white text-sm px-3 py-2 rounded-lg border border-gray-800 focus:border-cyan-500 focus:outline-none"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-gray-500 text-xs mb-1">Manager feedback score (0–10)</label>
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            max={10}
                                                            step={0.1}
                                                            value={mgrForm.manager_feedback_score}
                                                            onChange={e => setMgrForm({ ...mgrForm, manager_feedback_score: e.target.value })}
                                                            className="w-full bg-gray-900 text-white text-sm px-3 py-2 rounded-lg border border-gray-800 focus:border-cyan-500 focus:outline-none"
                                                        />
                                                    </div>
                                                    <button
                                                        type="submit"
                                                        disabled={profileSaveMut.isPending}
                                                        className="w-full bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white text-sm py-2.5 rounded-lg flex items-center justify-center gap-2"
                                                    >
                                                        {profileSaveMut.isPending && <Loader2 size={16} className="animate-spin" />}
                                                        Save management fields
                                                    </button>
                                                </form>
                                            </>
                                        ) : (
                                            <>
                                                <p className="text-xs text-gray-600 mb-3">
                                                    Read-only. Editing is limited to management accounts.
                                                </p>
                                                <dl className="space-y-2 text-sm">
                                                    <div className="flex justify-between gap-4">
                                                        <dt className="text-gray-500">Job role</dt>
                                                        <dd className="text-gray-200 text-right">{profileDetail.job_role ?? '—'}</dd>
                                                    </div>
                                                    <div className="flex justify-between gap-4">
                                                        <dt className="text-gray-500">Department</dt>
                                                        <dd className="text-gray-200 text-right">{profileDetail.department ?? '—'}</dd>
                                                    </div>
                                                    <div className="flex justify-between gap-4">
                                                        <dt className="text-gray-500">Salary</dt>
                                                        <dd className="text-gray-200 text-right">{profileDetail.salary ?? '—'}</dd>
                                                    </div>
                                                    <div className="flex justify-between gap-4">
                                                        <dt className="text-gray-500">Work location</dt>
                                                        <dd className="text-gray-200 text-right">{profileDetail.work_location ?? '—'}</dd>
                                                    </div>
                                                    <div className="flex justify-between gap-4">
                                                        <dt className="text-gray-500">Training hours</dt>
                                                        <dd className="text-gray-200">{profileDetail.training_hours ?? '—'}</dd>
                                                    </div>
                                                    <div className="flex justify-between gap-4">
                                                        <dt className="text-gray-500">Promotions</dt>
                                                        <dd className="text-gray-200">{profileDetail.promotions ?? '—'}</dd>
                                                    </div>
                                                    <div className="flex justify-between gap-4">
                                                        <dt className="text-gray-500">Absenteeism (days)</dt>
                                                        <dd className="text-gray-200">{profileDetail.absenteeism ?? '—'}</dd>
                                                    </div>
                                                    <div className="flex justify-between gap-4">
                                                        <dt className="text-gray-500">Distance from home (km)</dt>
                                                        <dd className="text-gray-200">{profileDetail.distance_from_home ?? '—'}</dd>
                                                    </div>
                                                    <div className="flex justify-between gap-4">
                                                        <dt className="text-gray-500">Manager feedback score</dt>
                                                        <dd className="text-gray-200">{profileDetail.manager_feedback_score ?? '—'}</dd>
                                                    </div>
                                                </dl>
                                            </>
                                        )}
                                    </section>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

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