<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

class FaceRecognitionController extends Controller
{
    public function managementLogs(Request $request): JsonResponse
    {
        $dateFilter = $request->query('date');
        $logs = $this->readFaceLogs($dateFilter);
        $workers = User::query()
            ->where('role', 'worker')
            ->get(['id', 'name', 'employee_id'])
            ->keyBy('id');

        $grouped = [];
        $unknown = [];

        foreach ($logs as $log) {
            $worker = $this->matchWorkerFromIdentifier($workers, (string) $log['identifier']);
            if (!$worker) {
                $unknown[] = $log;
                continue;
            }

            $workerId = (int) $worker->id;
            if (!isset($grouped[$workerId])) {
                $grouped[$workerId] = [
                    'worker' => [
                        'id' => $workerId,
                        'name' => $worker->name,
                        'employee_id' => $worker->employee_id,
                    ],
                    'logs' => [],
                ];
            }

            $grouped[$workerId]['logs'][] = $log;
        }

        foreach ($grouped as &$entry) {
            usort($entry['logs'], fn ($a, $b) => strcmp($b['timestamp'], $a['timestamp']));
        }

        $sortedGroups = array_values($grouped);
        usort($sortedGroups, fn ($a, $b) => strcasecmp($a['worker']['name'], $b['worker']['name']));

        return response()->json([
            'groups' => $sortedGroups,
            'unknown_logs' => $unknown,
        ]);
    }

    public function workerLogs(Request $request): JsonResponse
    {
        $user = $request->user();
        $dateFilter = $request->query('date');

        $logs = array_values(array_filter(
            $this->readFaceLogs($dateFilter),
            fn ($log) => $this->logBelongsToUser($log, $user)
        ));

        usort($logs, fn ($a, $b) => strcmp($b['timestamp'], $a['timestamp']));

        return response()->json([
            'worker' => [
                'id' => $user->id,
                'name' => $user->name,
                'employee_id' => $user->employee_id,
            ],
            'logs' => $logs,
        ]);
    }

    public function liveStreamStatus(): JsonResponse
    {
        $pid = $this->readPid();
        $running = $pid ? $this->isProcessRunning($pid) : false;

        return response()->json([
            'running' => $running,
            'pid' => $running ? $pid : null,
            'stream_url' => env('FACE_LIVE_STREAM_URL', 'http://127.0.0.1:5001/video_feed'),
            'step7_properties' => [
                'resolution' => '1280x720',
                'fps' => 30,
                'yolo_model' => 'yolov8s.pt',
                'yolo_confidence' => 0.3,
                'cooldown_seconds' => 10,
                'camera_source' => 'realsense',
            ],
            'note' => 'Use a Step 7 compatible MJPEG endpoint for stream_url.',
        ]);
    }

    public function startLiveStream(): JsonResponse
    {
        $existingPid = $this->readPid();
        if ($existingPid && $this->isProcessRunning($existingPid)) {
            return response()->json([
                'message' => 'Step 7 stream process already running.',
                'pid' => $existingPid,
            ]);
        }

        $scriptPath = base_path('../Face-Recognition-/step7_robust_attendance.py');
        if (!File::exists($scriptPath)) {
            return response()->json(['message' => 'Step 7 script not found.'], 404);
        }

        $logPath = storage_path('logs/face-step7-live.log');
        $command = sprintf(
            'nohup python3 %s > %s 2>&1 & echo $!',
            escapeshellarg($scriptPath),
            escapeshellarg($logPath)
        );

        $pid = trim((string) shell_exec($command));
        if ($pid === '' || !ctype_digit($pid)) {
            return response()->json(['message' => 'Unable to start Step 7 process.'], 500);
        }

        File::put($this->pidFilePath(), $pid);

        return response()->json([
            'message' => 'Step 7 process started.',
            'pid' => (int) $pid,
            'stream_url' => env('FACE_LIVE_STREAM_URL', 'http://127.0.0.1:5001/video_feed'),
        ]);
    }

    /**
     * @return array<int, array{timestamp: string, identifier: string, similarity: float, camera: string}>
     */
    private function readFaceLogs(?string $dateFilter = null): array
    {
        $path = base_path('../Face-Recognition-/detections_log.csv');
        if (!File::exists($path)) {
            return [];
        }

        $rows = [];
        if (($handle = fopen($path, 'r')) === false) {
            return [];
        }

        $isFirstRow = true;
        while (($row = fgetcsv($handle)) !== false) {
            if ($isFirstRow) {
                $isFirstRow = false;
                continue;
            }

            if (count($row) < 4) {
                continue;
            }

            $timestamp = trim((string) $row[0]);
            if ($dateFilter && !Str::startsWith($timestamp, $dateFilter)) {
                continue;
            }

            $rows[] = [
                'timestamp' => $timestamp,
                'identifier' => trim((string) $row[1]),
                'similarity' => (float) $row[2],
                'camera' => trim((string) $row[3]),
            ];
        }

        fclose($handle);
        return $rows;
    }

    private function matchWorkerFromIdentifier(Collection $workers, string $identifier): ?User
    {
        $needle = Str::lower(trim($identifier));
        if ($needle === '') {
            return null;
        }

        return $workers->first(function (User $worker) use ($needle) {
            $employeeId = Str::lower((string) $worker->employee_id);
            $name = Str::lower((string) $worker->name);
            return $needle === $employeeId || $needle === $name;
        });
    }

    private function logBelongsToUser(array $log, User $user): bool
    {
        $needle = Str::lower(trim((string) $log['identifier']));
        $employeeId = Str::lower((string) $user->employee_id);
        $name = Str::lower((string) $user->name);
        return $needle === $employeeId || $needle === $name;
    }

    private function pidFilePath(): string
    {
        return storage_path('app/face_step7.pid');
    }

    private function readPid(): ?int
    {
        $pidPath = $this->pidFilePath();
        if (!File::exists($pidPath)) {
            return null;
        }

        $pid = trim((string) File::get($pidPath));
        return ctype_digit($pid) ? (int) $pid : null;
    }

    private function isProcessRunning(int $pid): bool
    {
        $result = trim((string) shell_exec('ps -p ' . ((int) $pid) . ' -o pid='));
        return $result !== '';
    }
}
