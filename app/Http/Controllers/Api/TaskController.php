<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Task;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class TaskController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Task::with(['worker:id,name,employee_id,department', 'manager:id,name']);

        if ($request->has('status'))    $query->where('status', $request->status);
        if ($request->has('worker_id')) $query->where('assigned_to', $request->worker_id);
        if ($request->has('priority'))  $query->where('priority', $request->priority);

        return response()->json($query->latest()->get());
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'title'       => 'required|string|max:255',
            'description' => 'nullable|string',
            'worker_id'   => 'required|exists:users,id',
            'priority'    => 'required|in:low,medium,high',
            'location'    => 'nullable|string',
            'due_date'    => 'nullable|date',
        ]);

        $task = Task::create([
            'title'       => $request->title,
            'description' => $request->description,
            'assigned_to' => $request->worker_id,
            'assigned_by' => $request->user()->id,
            'priority'    => $request->priority,
            'location'    => $request->location,
            'due_date'    => $request->due_date,
            'status'      => 'pending',
        ]);

        $task->load(['worker:id,name', 'manager:id,name']);
        return response()->json($task, 201);
    }

    public function show(Task $task): JsonResponse
    {
        $task->load(['worker', 'manager', 'timeLogs.user']);
        return response()->json($task);
    }

    public function update(Request $request, Task $task): JsonResponse
    {
        $request->validate([
            'title'       => 'sometimes|string',
            'description' => 'nullable|string',
            'worker_id'   => 'sometimes|exists:users,id',
            'priority'    => 'sometimes|in:low,medium,high',
            'location'    => 'nullable|string',
            'due_date'    => 'nullable|date',
            'status'      => 'sometimes|in:pending,in_progress,completed,cancelled',
        ]);

        $task->update([
            'title'       => $request->title       ?? $task->title,
            'description' => $request->description ?? $task->description,
            'assigned_to' => $request->worker_id   ?? $task->assigned_to,
            'priority'    => $request->priority    ?? $task->priority,
            'location'    => $request->location    ?? $task->location,
            'due_date'    => $request->due_date    ?? $task->due_date,
            'status'      => $request->status      ?? $task->status,
        ]);

        return response()->json($task);
    }

    public function updateStatus(Request $request, Task $task): JsonResponse
    {
        $request->validate(['status' => 'required|in:pending,in_progress,completed,cancelled']);
        $task->update(['status' => $request->status]);
        return response()->json(['message' => 'Status updated', 'task' => $task]);
    }

    public function destroy(Task $task): JsonResponse
    {
        $task->delete();
        return response()->json(['message' => 'Task deleted']);
    }
}