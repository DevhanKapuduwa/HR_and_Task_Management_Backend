<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ManagementController;
use App\Http\Controllers\Api\WorkerController;
use App\Http\Controllers\Api\TaskController;
use App\Http\Controllers\Api\TimeLogController;
use App\Http\Controllers\Api\ShiftController;
use App\Http\Controllers\Api\AnnouncementController;

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
    });

    // ── Worker only ───────────────────────────────────
    Route::middleware('role:worker')->group(function () {
        Route::get('worker/dashboard',                 [WorkerController::class, 'dashboard']);
        Route::get('worker/my-tasks',                  [WorkerController::class, 'myTasks']);
        Route::patch('worker/tasks/{taskId}/start',    [WorkerController::class, 'startTask']);
        Route::patch('worker/tasks/{taskId}/complete', [WorkerController::class, 'completeTask']);
        Route::post('worker/clock-in',                 [TimeLogController::class, 'clockIn']);
        Route::post('worker/clock-out',                [TimeLogController::class, 'clockOut']);
        Route::get('worker/my-hours',                  [TimeLogController::class, 'myHours']);
        Route::get('worker/my-shift',                  [WorkerController::class, 'myShift']);
    });
});