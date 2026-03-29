<?php

namespace App\Services;

use App\Models\EngagementEventAttendance;
use App\Models\Task;
use App\Models\TimeLog;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Collection;

class EmployeeProfileMetricsService
{
    /**
     * Completed top-level tasks (projects) for the worker.
     */
    public function projectsCompleted(User $user): int
    {
        return Task::query()
            ->where('assigned_to', $user->id)
            ->whereNull('parent_id')
            ->where('status', 'completed')
            ->count();
    }

    /**
     * Sum of daily overtime minutes beyond 8h per calendar day, returned as hours (one decimal).
     */
    public function overtimeHours(User $user): float
    {
        $logs = TimeLog::query()
            ->where('user_id', $user->id)
            ->whereNotNull('clock_out')
            ->whereNotNull('duration_minutes')
            ->get(['clock_in', 'duration_minutes']);

        if ($logs->isEmpty()) {
            return 0.0;
        }

        $byDay = $logs->groupBy(fn (TimeLog $log) => Carbon::parse($log->clock_in)->toDateString());
        $overtimeMinutes = 0;
        foreach ($byDay as $dayLogs) {
            /** @var Collection<int, TimeLog> $dayLogs */
            $dayTotal = (int) $dayLogs->sum('duration_minutes');
            $overtimeMinutes += max(0, $dayTotal - 480);
        }

        return round($overtimeMinutes / 60, 1);
    }

    /**
     * Total clocked hours divided by months in period (joined_date or first log → now), min 1 month.
     */
    public function averageMonthlyHoursWorked(User $user): float
    {
        $totalMinutes = (int) TimeLog::query()
            ->where('user_id', $user->id)
            ->whereNotNull('duration_minutes')
            ->sum('duration_minutes');

        if ($totalMinutes === 0) {
            return 0.0;
        }

        $from = $this->periodStart($user);
        if ($from === null) {
            return 0.0;
        }

        $months = max(1, (int) ceil($from->diffInDays(Carbon::now()) / 30.0));

        return round(($totalMinutes / 60) / $months, 1);
    }

    public function tenure(User $user): ?array
    {
        if (!$user->joined_date) {
            return null;
        }

        $from = Carbon::parse($user->joined_date)->startOfDay();
        $now = Carbon::now();
        $totalDays = (int) $from->diffInDays($now);

        $diff = $from->diff($now);
        $labelParts = [];
        if ($diff->y > 0) {
            $labelParts[] = $diff->y.' '.($diff->y === 1 ? 'year' : 'years');
        }
        if ($diff->m > 0) {
            $labelParts[] = $diff->m.' '.($diff->m === 1 ? 'month' : 'months');
        }
        if ($diff->d > 0 && $diff->y === 0) {
            $labelParts[] = $diff->d.' '.($diff->d === 1 ? 'day' : 'days');
        }
        $label = $labelParts !== [] ? implode(', ', $labelParts) : '0 days';

        return [
            'total_days' => $totalDays,
            'label' => $label,
        ];
    }

    /**
     * Share of engagement events where this worker was marked present (among all events they were marked for).
     */
    public function engagementAttendancePercent(User $user): ?float
    {
        $total = EngagementEventAttendance::query()
            ->where('user_id', $user->id)
            ->count();

        if ($total === 0) {
            return null;
        }

        $present = EngagementEventAttendance::query()
            ->where('user_id', $user->id)
            ->where('status', 'present')
            ->count();

        return round(100.0 * $present / $total, 1);
    }

    /**
     * Work–life balance label from engagement attendance % (see product rules).
     */
    public function workLifeBalanceFromAttendance(?float $percent): ?string
    {
        if ($percent === null) {
            return null;
        }

        if ($percent < 20) {
            return 'Poor';
        }
        if ($percent < 50) {
            return 'Average';
        }
        if ($percent < 70) {
            return 'Good';
        }

        return 'Excellent';
    }

    public function all(User $user): array
    {
        $attendancePct = $this->engagementAttendancePercent($user);

        return [
            'tenure' => $this->tenure($user),
            'projects_completed' => $this->projectsCompleted($user),
            'overtime_hours' => $this->overtimeHours($user),
            'average_monthly_hours_worked' => $this->averageMonthlyHoursWorked($user),
            'engagement_attendance_pct' => $attendancePct,
            'work_life_balance' => $this->workLifeBalanceFromAttendance($attendancePct),
        ];
    }

    private function periodStart(User $user): ?Carbon
    {
        if ($user->joined_date) {
            return Carbon::parse($user->joined_date)->startOfDay();
        }

        $first = TimeLog::query()
            ->where('user_id', $user->id)
            ->min('clock_in');

        return $first ? Carbon::parse($first)->startOfDay() : null;
    }
}
