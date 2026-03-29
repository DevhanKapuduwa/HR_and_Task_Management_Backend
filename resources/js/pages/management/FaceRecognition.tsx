import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { faceRecognitionApi } from '../../api/faceRecognition';
import { Camera, Loader2, PlayCircle, RefreshCw } from 'lucide-react';

const fmtDateTime = (value: string) =>
    new Date(value).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });

export default function FaceRecognition() {
    const qc = useQueryClient();
    const [dateFilter, setDateFilter] = useState('');

    const { data: groupedData, isLoading } = useQuery({
        queryKey: ['face-management-logs', dateFilter],
        queryFn: () => faceRecognitionApi.managementLogs(dateFilter ? { date: dateFilter } : undefined),
    });

    const { data: liveStatus, isFetching: liveStatusLoading } = useQuery({
        queryKey: ['face-live-status'],
        queryFn: faceRecognitionApi.liveStatus,
        refetchInterval: 10000,
    });

    const startStream = useMutation({
        mutationFn: faceRecognitionApi.startLiveStream,
        onSuccess: () => qc.invalidateQueries({ queryKey: ['face-live-status'] }),
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Camera size={24} className="text-blue-400" /> Face Recognition Logs
                </h1>
                <div className="flex items-center gap-2">
                    <input
                        type="date"
                        value={dateFilter}
                        onChange={e => setDateFilter(e.target.value)}
                        className="bg-gray-900 text-gray-300 text-sm px-3 py-2 rounded-lg border border-gray-800 focus:outline-none focus:border-blue-500"
                    />
                    {dateFilter && (
                        <button className="text-xs text-gray-400 hover:text-white" onClick={() => setDateFilter('')}>
                            Clear
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 sm:p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="font-semibold text-white">Live Stream (Step 7)</h2>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => qc.invalidateQueries({ queryKey: ['face-live-status'] })}
                            className="px-3 py-2 text-xs bg-gray-800 hover:bg-gray-700 rounded-md text-gray-200 flex items-center gap-1"
                        >
                            <RefreshCw size={14} className={liveStatusLoading ? 'animate-spin' : ''} />
                            Refresh
                        </button>
                        <button
                            onClick={() => startStream.mutate()}
                            disabled={startStream.isPending}
                            className="px-3 py-2 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-md text-white flex items-center gap-1"
                        >
                            {startStream.isPending ? <Loader2 size={14} className="animate-spin" /> : <PlayCircle size={14} />}
                            Start Step 7
                        </button>
                    </div>
                </div>

                <div className="text-sm text-gray-300">
                    Status:{' '}
                    <span className={liveStatus?.running ? 'text-green-400 font-semibold' : 'text-yellow-400 font-semibold'}>
                        {liveStatus?.running ? 'Running' : 'Not Running'}
                    </span>
                    {liveStatus?.pid ? <span className="text-gray-500"> · PID {liveStatus.pid}</span> : null}
                </div>

                <div className="text-xs text-gray-400">
                    Stream URL:{' '}
                    {liveStatus?.stream_url ? (
                        <a className="text-blue-400 underline" href={liveStatus.stream_url} target="_blank" rel="noreferrer">
                            {liveStatus.stream_url}
                        </a>
                    ) : (
                        'Not configured'
                    )}
                </div>

                {liveStatus?.step7_properties && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                        <div className="bg-gray-800/70 px-3 py-2 rounded">Resolution: {liveStatus.step7_properties.resolution}</div>
                        <div className="bg-gray-800/70 px-3 py-2 rounded">FPS: {liveStatus.step7_properties.fps}</div>
                        <div className="bg-gray-800/70 px-3 py-2 rounded">YOLO: {liveStatus.step7_properties.yolo_model}</div>
                        <div className="bg-gray-800/70 px-3 py-2 rounded">Confidence: {liveStatus.step7_properties.yolo_confidence}</div>
                        <div className="bg-gray-800/70 px-3 py-2 rounded">Cooldown: {liveStatus.step7_properties.cooldown_seconds}s</div>
                        <div className="bg-gray-800/70 px-3 py-2 rounded">Camera: {liveStatus.step7_properties.camera_source}</div>
                    </div>
                )}
            </div>

            {isLoading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="animate-spin text-blue-400" />
                </div>
            ) : groupedData?.groups?.length ? (
                <div className="space-y-4">
                    {groupedData.groups.map(group => (
                        <div key={group.worker.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                            <div className="px-5 py-3 border-b border-gray-800">
                                <p className="font-semibold">{group.worker.name}</p>
                                <p className="text-xs text-gray-500">{group.worker.employee_id} · {group.logs.length} detections</p>
                            </div>
                            <div className="max-h-72 overflow-y-auto divide-y divide-gray-800">
                                {group.logs.map((log, idx) => (
                                    <div key={`${group.worker.id}-${idx}`} className="px-5 py-3 text-sm flex items-center justify-between gap-3">
                                        <span className="text-gray-200">{fmtDateTime(log.timestamp)}</span>
                                        <span className="text-gray-400">sim {log.similarity.toFixed(4)} · {log.camera}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-12 text-gray-500">No face detections found for selected filters.</div>
            )}
        </div>
    );
}
