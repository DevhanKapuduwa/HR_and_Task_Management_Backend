<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Task extends Model
{
    use HasFactory;

    protected $fillable = [
        'title',
        'description',
        'assigned_to',
        'assigned_by',
        'status',
        'priority',
        'location',
        'due_date',
    ];

    protected $casts = [
        'due_date' => 'datetime',
    ];

    // ── Relationships ─────────────────────────────────

    // The worker this task is assigned to
    public function worker()
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    // The manager who assigned this task
    public function manager()
    {
        return $this->belongsTo(User::class, 'assigned_by');
    }

    // Time logs recorded against this task
    public function timeLogs()
    {
        return $this->hasMany(TimeLog::class);
    }
}