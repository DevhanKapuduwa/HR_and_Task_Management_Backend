<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Shift;
use App\Models\TimeLog;
use App\Models\Task;
use App\Models\TaskCompletionPhoto;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;

class WorkerController extends Controller
{
    private function haversineMeters(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earthRadius = 6371000.0;
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) * sin($dLat / 2)
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2))
            * sin($dLng / 2) * sin($dLng / 2);
        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));
        return $earthRadius * $c;
    }

    public function index(): JsonResponse
    {
        $workers = User::where('role', 'worker')
                    ->withCount('tasks')
                    ->latest()->get();
        return response()->json($workers);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'name'        => 'required|string|max:255',
            'email'       => 'required|email|unique:users',
            'password'    => 'required|min:6',
            'employee_id' => 'required|unique:users',
            'department'  => 'required|string',
            'phone'       => 'nullable|string',
        ]);

        $worker = User::create([
            'name'        => $request->name,
            'email'       => $request->email,
            'password'    => Hash::make($request->password),
            'role'        => 'worker',
            'employee_id' => $request->employee_id,
            'department'  => $request->department,
            'phone'       => $request->phone,
            'is_active'   => true,
        ]);

        return response()->json($worker, 201);
    }

    public function show(User $worker): JsonResponse
    {
        $worker->load(['tasks', 'shifts', 'timeLogs']);
        return response()->json($worker);
    }

    public function update(Request $request, User $worker): JsonResponse
    {
        $request->validate([
            'name'        => 'sometimes|string',
            'email'       => 'sometimes|email|unique:users,email,' . $worker->id,
            'employee_id' => 'sometimes|unique:users,employee_id,' . $worker->id,
            'department'  => 'sometimes|string',
            'phone'       => 'nullable|string',
            'password'    => 'nullable|min:6',
        ]);

        $data = $request->only(['name', 'email', 'employee_id', 'department', 'phone']);
        if ($request->filled('password')) {
            $data['password'] = Hash::make($request->password);
        }

        $worker->update($data);
        return response()->json($worker);
    }

    public function destroy(User $worker): JsonResponse
    {
        $worker->delete();
        return response()->json(['message' => 'Worker deleted']);
    }

    public function toggleStatus(User $worker): JsonResponse
    {
        $worker->update(['is_active' => !$worker->is_active]);
        return response()->json([
            'message'   => $worker->is_active ? 'Activated' : 'Deactivated',
            'is_active' => $worker->is_active,
        ]);
    }

    // ── Worker-facing methods ─────────────────────────

    public function dashboard(Request $request): JsonResponse
    {
        $user = $request->user();
        return response()->json([
            'pending_tasks'   => $user->tasks()->where('status', 'pending')->count(),
            'in_progress'     => $user->tasks()->where('status', 'in_progress')->count(),
            'completed_today' => $user->tasks()->where('status', 'completed')
                                    ->whereDate('updated_at', today())->count(),
            'pending_approval'=> $user->tasks()->where('status', 'pending_approval')->count(),
            'hours_this_week' => round(
                $user->timeLogs()
                    ->whereBetween('clock_in', [now()->startOfWeek(), now()])
                    ->sum('duration_minutes') / 60, 2
            ),
            'is_clocked_in'   => $user->timeLogs()->whereNull('clock_out')->exists(),
            'todays_shift'    => Shift::where('user_id', $user->id)
                                    ->where('date', today())->first(),
        ]);
    }

    public function myTasks(Request $request): JsonResponse
    {
        $tasks = $request->user()->tasks()
                         ->with([
                             'manager:id,name',
                             'subtasks.completionPhotos',
                             'completionPhotos',
                             'parent:id,title',
                         ])
                         ->whereNull('parent_id') // Only top-level tasks
                         ->latest()->get();

        // Also include sub-tasks assigned to this worker that belong to a parent
        $subTasks = $request->user()->tasks()
                            ->with([
                                'completionPhotos',
                                'parent:id,title',
                            ])
                            ->whereNotNull('parent_id')
                            ->latest()->get();

        // Merge: top-level tasks already include their subtasks via eager-loading
        // Return both sets for the frontend to use
        return response()->json([
            'tasks' => $tasks,
            'subtasks' => $subTasks,
        ]);
    }

    public function startTask(Request $request, $taskId): JsonResponse
    {
        $request->validate([
            'lat' => 'required|numeric',
            'lng' => 'required|numeric',
        ]);

        $task = $request->user()->tasks()->findOrFail($taskId);
        if ($task->status !== 'pending') {
            return response()->json(['message' => 'Task cannot be started'], 400);
        }

        if ($task->location_lat === null || $task->location_lng === null) {
            return response()->json(['message' => 'Task has no work location assigned'], 400);
        }

        $distance = $this->haversineMeters(
            (float) $request->lat,
            (float) $request->lng,
            (float) $task->location_lat,
            (float) $task->location_lng,
        );

        if ($distance > 50) {
            return response()->json(['message' => 'Please go to the work location to start the work.'], 403);
        }

        $task->update(['status' => 'in_progress']);

        // If this is a sub-task, also start the parent if pending
        if ($task->parent_id) {
            $parent = $task->parent;
            if ($parent->status === 'pending') {
                $parent->update(['status' => 'in_progress']);
            }
        }

        return response()->json(['message' => 'Task started', 'task' => $task]);
    }

    /**
     * Worker submits task for completion approval with photos.
     * Photos are stored locally in storage/app/public/task-photos/
     */
    public function submitForApproval(Request $request, $taskId): JsonResponse
    {
        $request->validate([
            'photos'   => 'required|array|min:1',
            'photos.*' => 'required|image|mimes:jpeg,jpg,png,webp|max:10240', // Max 10MB each
        ]);

        $task = $request->user()->tasks()->findOrFail($taskId);
        if ($task->status !== 'in_progress') {
            return response()->json(['message' => 'Task must be in progress to submit for approval'], 400);
        }

        // Ensure the storage link exists
        $storagePath = 'task-photos/' . $task->id;

        // Store each photo
        $photos = [];
        foreach ($request->file('photos') as $photo) {
            $path = $photo->store($storagePath, 'public');
            $url = asset('storage/' . $path);

            $photos[] = TaskCompletionPhoto::create([
                'task_id'    => $task->id,
                'photo_path' => $path,
                'photo_url'  => $url,
            ]);
        }

        // Update task status to pending_approval
        $task->update([
            'status' => 'pending_approval',
            'approval_notes' => null, // Clear any previous rejection notes
        ]);

        $task->load('completionPhotos');

        return response()->json([
            'message' => 'Task submitted for approval',
            'task' => $task,
            'photos' => $photos,
        ]);
    }

    /**
     * Legacy complete task — kept for backward compatibility but now redirects to approval.
     */
    public function completeTask(Request $request, $taskId): JsonResponse
    {
        // Completion now requires photo evidence and management approval.
        return response()->json([
            'message' => 'Use submit-completion with at least one photo to request completion approval.',
        ], 422);
    }

    public function myShift(Request $request): JsonResponse
    {
        $shift = Shift::where('user_id', $request->user()->id)
                    ->where('date', today())->first();
        return response()->json($shift);
    }
}