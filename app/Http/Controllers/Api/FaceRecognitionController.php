<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\StreamedResponse;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
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
        $runningByPid = $pid ? $this->isProcessRunning($pid) : false;
        $runningByStream = $this->canReachStreamUrl($this->streamUrl());
        $running = $runningByPid || $runningByStream;

        return response()->json([
            'running' => $running,
            'pid' => $runningByPid ? $pid : null,
            'stream_url' => $this->streamUrl(),
            'proxy_stream_url' => '/api/face/live-stream/proxy',
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
        if ($this->canReachStreamUrl($this->streamUrl())) {
            return response()->json([
                'message' => 'Live stream is already reachable.',
                'pid' => $this->readPid(),
                'stream_url' => $this->streamUrl(),
                'proxy_stream_url' => '/api/face/live-stream/proxy',
            ]);
        }

        $existingPid = $this->readPid();
        if ($existingPid && $this->isProcessRunning($existingPid)) {
            return response()->json([
                'message' => 'Step 7 stream process already running.',
                'pid' => $existingPid,
                'proxy_stream_url' => '/api/face/live-stream/proxy',
            ]);
        }

        $scriptPath = $this->step7ScriptPath();
        if (!File::exists($scriptPath)) {
            return response()->json([
                'message' => 'Step 7 script not found.',
                'script_path' => $scriptPath,
            ], 404);
        }

        $logPath = storage_path('logs/face-step7-live.log');
        $pid = $this->startStep7Process($scriptPath, $logPath, $this->step7CliArgs());
        if ($pid !== null) {
            File::put($this->pidFilePath(), (string) $pid);
        } else {
            File::delete($this->pidFilePath());
        }

        return response()->json([
            'message' => 'Step 7 start command submitted.',
            'pid' => $pid,
            'stream_url' => $this->streamUrl(),
            'proxy_stream_url' => '/api/face/live-stream/proxy',
            'script_path' => $scriptPath,
            'log_path' => $logPath,
        ]);
    }

    /**
     * Proxy the MJPEG stream from Step 7 Python server to the browser.
     * This avoids CORS issues since the browser only talks to Laravel (same origin).
     */
    public function proxyLiveStream(Request $request): StreamedResponse
    {
        $streamUrl = $this->streamUrl();

        return response()->stream(function () use ($streamUrl) {
            $ch = curl_init($streamUrl);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, false);
            curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
            curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
            curl_setopt($ch, CURLOPT_TIMEOUT, 0); // no timeout — stream runs indefinitely
            curl_setopt($ch, CURLOPT_WRITEFUNCTION, function ($curl, $data) {
                echo $data;
                if (ob_get_level()) {
                    ob_flush();
                }
                flush();
                return strlen($data);
            });
            curl_exec($ch);
            curl_close($ch);
        }, 200, [
            'Content-Type' => 'multipart/x-mixed-replace; boundary=frame',
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
            'Pragma' => 'no-cache',
            'Expires' => '0',
            'X-Accel-Buffering' => 'no',
            'Access-Control-Allow-Origin' => '*',
        ]);
    }

    /**
     * @return array<int, array{timestamp: string, identifier: string, similarity: float, camera: string}>
     */
    private function readFaceLogs(?string $dateFilter = null): array
    {
        $path = $this->detectionsCsvPath();
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
        if (PHP_OS_FAMILY === 'Windows') {
            $result = trim((string) shell_exec('tasklist /FI "PID eq ' . ((int) $pid) . '" /NH'));
            return $result !== '' && !Str::contains(Str::lower($result), 'no tasks are running');
        }

        $result = trim((string) shell_exec('ps -p ' . ((int) $pid) . ' -o pid='));
        return $result !== '';
    }

    private function faceDetectionBasePath(): string
    {
        return (string) env('FACE_DETECTION_PATH', base_path('../faceDetection'));
    }

    private function step7ScriptPath(): string
    {
        $scriptFile = (string) env('FACE_STEP7_SCRIPT', 'step7_robust_attendance.py');
        return rtrim($this->faceDetectionBasePath(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . $scriptFile;
    }

    private function detectionsCsvPath(): string
    {
        return rtrim($this->faceDetectionBasePath(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'detections_log.csv';
    }

    private function streamUrl(): string
    {
        return (string) env('FACE_LIVE_STREAM_URL', 'http://127.0.0.1:5001/video_feed');
    }

    /** Port parsed from FACE_LIVE_STREAM_URL (must match --http-port passed to Step 7). */
    private function streamPort(): int
    {
        $parts = parse_url($this->streamUrl());

        return isset($parts['port']) ? (int) $parts['port'] : 5001;
    }

    /**
     * CLI flags so Step 7 serves MJPEG at /video_feed and skips cv2 window (background run).
     *
     * @return array<int, string>
     */
    private function step7CliArgs(): array
    {
        return [
            '--http',
            '--http-port',
            (string) $this->streamPort(),
            '--no-window',
        ];
    }

    /**
     * @param  array<int, string>  $extraArgs
     */
    private function startStep7Process(string $scriptPath, string $logPath, array $extraArgs = []): ?int
    {
        if (PHP_OS_FAMILY === 'Windows') {
            $pythonBin = (string) env('FACE_PYTHON_BIN', 'python');
            $workingDir = dirname($scriptPath);
            $scriptFile = basename($scriptPath);

            // Build the argument list for python: script + extra args
            $allArgs = array_merge([$scriptFile], $extraArgs);

            // Escape each arg for use inside a PowerShell double-quoted string
            $escapedForPs = array_map(function (string $a) {
                return '"' . addslashes($a) . '"';
            }, $allArgs);
            $argsString = implode(' ', $escapedForPs);

            // Escape paths for PowerShell single-quoted strings
            $safePython  = str_replace("'", "''", $pythonBin);
            $safeWorkDir = str_replace("'", "''", $workingDir);
            $safeLog     = str_replace("'", "''", $logPath);

            // Use cmd /c start /b to run python in background and redirect output to log
            // Start-Process with -RedirectStandardOutput captures output; combine both streams
            $psCommand = sprintf(
                "\$p = Start-Process -FilePath '%s' -ArgumentList %s -WorkingDirectory '%s' -WindowStyle Hidden -RedirectStandardOutput '%s' -RedirectStandardError '%s' -PassThru; \$p.Id",
                $safePython,
                $argsString,
                $safeWorkDir,
                $safeLog,
                $safeLog
            );

            $command = 'powershell -NoProfile -ExecutionPolicy Bypass -Command ' . escapeshellarg($psCommand);
            $pid = trim((string) shell_exec($command));

            \Illuminate\Support\Facades\Log::info("[Step7] Windows launch PID=[$pid] cmd=[$command]");

            return ctype_digit(trim($pid)) ? (int) trim($pid) : null;
        }

        // Linux / macOS
        $pythonBin = (string) env('FACE_PYTHON_BIN', 'python3');
        $parts = [escapeshellarg($pythonBin), escapeshellarg($scriptPath)];
        foreach ($extraArgs as $a) {
            $parts[] = escapeshellarg($a);
        }
        $command = sprintf(
            'nohup %s > %s 2>&1 & echo $!',
            implode(' ', $parts),
            escapeshellarg($logPath)
        );
        $pid = trim((string) shell_exec($command));

        return ctype_digit($pid) ? (int) $pid : null;
    }

    /**
     * Check if the Step 7 stream server is listening by opening a TCP socket.
     * Using HTTP HEAD is unreliable for MJPEG endpoints (hangs waiting for stream data).
     */
    private function canReachStreamUrl(string $url): bool
    {
        if ($url === '') {
            return false;
        }

        $parts = parse_url($url);
        $host  = $parts['host'] ?? '127.0.0.1';
        $port  = $parts['port'] ?? 5001;

        // fsockopen with a 2-second timeout just checks if the TCP port is open
        $fp = @fsockopen($host, (int) $port, $errno, $errstr, 2.0);
        if ($fp) {
            fclose($fp);
            return true;
        }

        return false;
    }
}
