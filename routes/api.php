<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ManagementController;
use App\Http\Controllers\Api\WorkerController;
use App\Http\Controllers\Api\TaskController;
use App\Http\Controllers\Api\TimeLogController;
use App\Http\Controllers\Api\ShiftController;
use App\Http\Controllers\Api\AnnouncementController;
use App\Http\Controllers\Api\EngagementEventController;
use App\Http\Controllers\Api\LeaveTypeController;
use App\Http\Controllers\Api\LeaveRequestController;

// ── Public ────────────────────────────────────────────
Route::post('/login', [AuthController::class, 'login']);

// ── Protected ─────────────────────────────────────────
Route::middleware('auth:sanctum')->group(function () {

    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me',      [AuthController::class, 'me']);

    // ── Management only ───────────────────────────────
    Route::middleware('role:management')->group(function () {
        Route::get('dashboard/stats',                  [ManagementController::class, 'stats']);
        Route::apiResource('workers',                  WorkerController::class);
        Route::patch('workers/{worker}/toggle-status', [WorkerController::class, 'toggleStatus']);
        Route::apiResource('tasks',                    TaskController::class);
        Route::patch('tasks/{task}/status',            [TaskController::class, 'updateStatus']);
        Route::get('time-logs',                        [TimeLogController::class, 'index']);
        Route::get('time-logs/{worker}',               [TimeLogController::class, 'workerLogs']);
        Route::apiResource('shifts',                   ShiftController::class);
        Route::apiResource('announcements',            AnnouncementController::class);

        // Task completion approval/rejection
        Route::patch('tasks/{task}/approve-completion', [TaskController::class, 'approveCompletion']);
        Route::patch('tasks/{task}/reject-completion',  [TaskController::class, 'rejectCompletion']);

        Route::get('engagement/events',                        [EngagementEventController::class, 'index']);
        Route::post('engagement/events',                       [EngagementEventController::class, 'store']);
        Route::get('engagement/events/{event}',                [EngagementEventController::class, 'show']);
        Route::put('engagement/events/{event}',                [EngagementEventController::class, 'update']);
        Route::delete('engagement/events/{event}',             [EngagementEventController::class, 'destroy']);
        Route::put('engagement/events/{event}/attendance',     [EngagementEventController::class, 'upsertAttendance']);

        // Leave management admin (create/update/delete leave types)
        Route::get('leave/types',                    [LeaveTypeController::class, 'index']);
        Route::post('leave/types',                   [LeaveTypeController::class, 'store']);
        Route::put('leave/types/{leaveType}',        [LeaveTypeController::class, 'update']);
        Route::delete('leave/types/{leaveType}',     [LeaveTypeController::class, 'destroy']);
    });

    // ── Worker only ───────────────────────────────────
    Route::middleware('role:worker')->group(function () {
        Route::get('worker/dashboard',                 [WorkerController::class, 'dashboard']);
        Route::get('worker/my-tasks',                  [WorkerController::class, 'myTasks']);
        Route::patch('worker/tasks/{taskId}/start',    [WorkerController::class, 'startTask']);
        Route::patch('worker/tasks/{taskId}/complete', [WorkerController::class, 'completeTask']);
        Route::post('worker/tasks/{taskId}/submit-completion', [WorkerController::class, 'submitForApproval']);
        Route::post('worker/clock-in',                 [TimeLogController::class, 'clockIn']);
        Route::post('worker/clock-out',                [TimeLogController::class, 'clockOut']);
        Route::get('worker/my-hours',                  [TimeLogController::class, 'myHours']);
        Route::get('worker/my-shift',                  [WorkerController::class, 'myShift']);

        // Leave requests (worker)
        Route::get('worker/leave/types', [LeaveTypeController::class, 'active']);
        Route::get('worker/leave/requests', [LeaveRequestController::class, 'myRequests']);
        Route::get('worker/leave/balances', [LeaveRequestController::class, 'myBalances']);
        Route::post('worker/leave/requests', [LeaveRequestController::class, 'store']);
    });

    // Approvers: supervisor/hr/management (role-based chain)
    Route::middleware('role:supervisor,hr,management')->group(function () {
        Route::get('leave/inbox', [LeaveRequestController::class, 'inbox']);
        Route::post('leave/requests/{leaveRequest}/act', [LeaveRequestController::class, 'act']);
        Route::get('leave/types', [LeaveTypeController::class, 'index']);
    });
});