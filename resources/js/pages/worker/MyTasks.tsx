import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { taskApi } from '../../api/tasks';
import { Task } from '../../types';
import { ClipboardList, Loader2, Play, CheckCircle2, MapPin, Calendar, User } from 'lucide-react';

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
const tabs = ['all', 'pending', 'in_progress', 'completed'] as const;

export default function MyTasks() {
    const qc = useQueryClient();
    const [filter, setFilter] = useState<string>('all');

    const { data: tasks = [], isLoading } = useQuery<Task[]>({
        queryKey: ['my-tasks'],
        queryFn: taskApi.myTasks,
    });

    const startMut = useMutation({
        mutationFn: taskApi.start,
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-tasks'] }); qc.invalidateQueries({ queryKey: ['worker-dashboard'] }); },
    });

    const completeMut = useMutation({
        mutationFn: taskApi.complete,
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-tasks'] }); qc.invalidateQueries({ queryKey: ['worker-dashboard'] }); },
    });

    const filtered = filter === 'all' ? tasks : tasks.filter(t => t.status === filter);

    const fmtDate = (d: string | null) => {
        if (!d) return null;
        return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold flex items-center gap-2">
                <ClipboardList size={24} className="text-green-400" /> My Tasks
                <span className="text-sm font-normal text-gray-500 ml-2">({tasks.length})</span>
            </h1>

            {/* Filter Tabs */}
            <div className="flex gap-2 flex-wrap">
                {tabs.map(t => (
                    <button key={t} onClick={() => setFilter(t)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition ${filter === t
                                ? 'bg-green-600 text-white'
                                : 'bg-gray-900 text-gray-400 border border-gray-800 hover:border-gray-700 hover:text-white'
                            }`}>
                        {t === 'all' ? 'All' : t === 'in_progress' ? 'In Progress' : t.charAt(0).toUpperCase() + t.slice(1)}
                        <span className="ml-1.5 text-xs opacity-70">
                            ({t === 'all' ? tasks.length : tasks.filter(tk => tk.status === t).length})
                        </span>
                    </button>
                ))}
            </div>

            {/* Task List */}
            {isLoading ? (
                <div className="flex justify-center py-16"><Loader2 className="animate-spin text-green-400" size={28} /></div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                    {filter === 'all' ? 'No tasks assigned yet' : `No ${filter.replace('_', ' ')} tasks`}
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(t => (
                        <div key={t.id} className="bg-gray-900 rounded-xl border border-gray-800 p-5 hover:border-gray-700 transition">
                            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start gap-3 mb-2">
                                        <h3 className="font-semibold text-white">{t.title}</h3>
                                        <div className="flex gap-2 flex-shrink-0 mt-0.5">
                                            <span className={`px-2 py-0.5 rounded-full text-xs ${statusBadge[t.status]}`}>{t.status.replace('_', ' ')}</span>
                                            <span className={`px-2 py-0.5 rounded-full text-xs ${priorityBadge[t.priority]}`}>{t.priority}</span>
                                        </div>
                                    </div>
                                    {t.description && <p className="text-gray-400 text-sm mb-3">{t.description}</p>}
                                    <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                                        {t.manager && <span className="flex items-center gap-1"><User size={12} /> Assigned by {t.manager.name}</span>}
                                        {t.location && <span className="flex items-center gap-1"><MapPin size={12} /> {t.location}</span>}
                                        {t.due_date && <span className="flex items-center gap-1"><Calendar size={12} /> Due {fmtDate(t.due_date)}</span>}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex-shrink-0">
                                    {t.status === 'pending' && (
                                        <button onClick={() => startMut.mutate(t.id)} disabled={startMut.isPending}
                                            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm px-4 py-2.5 rounded-lg flex items-center gap-2 transition">
                                            {startMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} Start
                                        </button>
                                    )}
                                    {t.status === 'in_progress' && (
                                        <button onClick={() => completeMut.mutate(t.id)} disabled={completeMut.isPending}
                                            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm px-4 py-2.5 rounded-lg flex items-center gap-2 transition">
                                            {completeMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Complete
                                        </button>
                                    )}
                                    {t.status === 'completed' && (
                                        <span className="text-green-400 text-sm flex items-center gap-1"><CheckCircle2 size={14} /> Done</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}