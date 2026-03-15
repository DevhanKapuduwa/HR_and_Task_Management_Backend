<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Shift;
use App\Models\TimeLog;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;

class WorkerController extends Controller
{
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
                         ->with('manager:id,name')
                         ->latest()->get();
        return response()->json($tasks);
    }

    public function startTask(Request $request, $taskId): JsonResponse
    {
        $task = $request->user()->tasks()->findOrFail($taskId);
        if ($task->status !== 'pending') {
            return response()->json(['message' => 'Task cannot be started'], 400);
        }
        $task->update(['status' => 'in_progress']);
        return response()->json(['message' => 'Task started', 'task' => $task]);
    }

    public function completeTask(Request $request, $taskId): JsonResponse
    {
        $task = $request->user()->tasks()->findOrFail($taskId);
        if ($task->status !== 'in_progress') {
            return response()->json(['message' => 'Task must be in progress first'], 400);
        }
        $task->update(['status' => 'completed']);
        return response()->json(['message' => 'Task completed!', 'task' => $task]);
    }

    public function myShift(Request $request): JsonResponse
    {
        $shift = Shift::where('user_id', $request->user()->id)
                    ->where('date', today())->first();
        return response()->json($shift);
    }
}