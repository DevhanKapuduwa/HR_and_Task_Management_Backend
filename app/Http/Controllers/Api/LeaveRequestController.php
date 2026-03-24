<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LeaveApproval;
use App\Models\LeaveBalance;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LeaveRequestController extends Controller
{
    // Worker: list my requests
    public function myRequests(Request $request): JsonResponse
    {
        $q = LeaveRequest::where('user_id', $request->user()->id)
            ->with(['leaveType', 'approvals.actor:id,name'])
            ->orderByDesc('created_at');

        return response()->json($q->get());
    }

    // Worker: get my balances for current year
    public function myBalances(Request $request): JsonResponse
    {
        $year = (int) now()->format('Y');

        $types = LeaveType::where('is_active', true)->orderBy('name')->get();

        foreach ($types as $t) {
            LeaveBalance::firstOrCreate(
                ['user_id' => $request->user()->id, 'leave_type_id' => $t->id, 'year' => $year],
                ['entitled_hours' => $t->yearly_entitlement_hours, 'used_hours' => 0]
            );
        }

        $balances = LeaveBalance::where('user_id', $request->user()->id)
            ->where('year', $year)
            ->with('leaveType')
            ->get();

        return response()->json($balances);
    }

    // Worker: submit leave request
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'leave_type_id' => 'required|exists:leave_types,id',
            'start_at' => 'required|date',
            'end_at' => 'required|date|after_or_equal:start_at',
            'duration_hours' => 'required|integer|min:1',
            'reason' => 'nullable|string',
        ]);

        $type = LeaveType::findOrFail($request->leave_type_id);
        if (!$type->is_active) {
            return response()->json(['message' => 'Leave type is not active'], 400);
        }

        // Notice policy
        if ($type->min_notice_hours > 0) {
            $minStart = now()->addHours($type->min_notice_hours);
            if (now()->parse($request->start_at)->lt($minStart)) {
                return response()->json(['message' => 'Leave request does not meet minimum notice period'], 400);
            }
        }

        if ($type->max_consecutive_hours !== null && $request->duration_hours > $type->max_consecutive_hours) {
            return response()->json(['message' => 'Leave request exceeds max consecutive hours'], 400);
        }

        $year = (int) now()->parse($request->start_at)->format('Y');

        $balance = LeaveBalance::firstOrCreate(
            ['user_id' => $request->user()->id, 'leave_type_id' => $type->id, 'year' => $year],
            ['entitled_hours' => $type->yearly_entitlement_hours, 'used_hours' => 0]
        );

        $remaining = (int) $balance->entitled_hours - (int) $balance->used_hours;
        if ($request->duration_hours > $remaining) {
            return response()->json(['message' => 'Insufficient leave balance'], 400);
        }

        return DB::transaction(function () use ($request, $type) {
            $lr = LeaveRequest::create([
                'user_id' => $request->user()->id,
                'leave_type_id' => $type->id,
                'start_at' => $request->start_at,
                'end_at' => $request->end_at,
                'duration_hours' => $request->duration_hours,
                'reason' => $request->reason,
                'status' => 'pending',
                'current_step' => 0,
                'submitted_at' => now(),
            ]);

            $chain = $type->approval_chain_roles ?? [];
            foreach ($chain as $idx => $role) {
                LeaveApproval::create([
                    'leave_request_id' => $lr->id,
                    'step_index' => $idx,
                    'required_role' => $role,
                ]);
            }

            $lr->load(['leaveType', 'approvals']);
            return response()->json($lr, 201);
        });
    }

    // Approver (role-based): list pending approvals for my role
    public function inbox(Request $request): JsonResponse
    {
        $role = $request->user()->role;

        $pending = LeaveApproval::where('required_role', $role)
            ->whereNull('action')
            ->with([
                'leaveRequest.user:id,name,employee_id,department',
                'leaveRequest.leaveType',
            ])
            ->orderByDesc('created_at')
            ->get();

        return response()->json($pending);
    }

    // Approver: approve/reject a request at the current step (must match role)
    public function act(Request $request, LeaveRequest $leaveRequest): JsonResponse
    {
        $request->validate([
            'action' => 'required|in:approved,rejected',
            'comment' => 'nullable|string|max:255',
        ]);

        $user = $request->user();
        $type = $leaveRequest->leaveType()->firstOrFail();
        $chain = $type->approval_chain_roles ?? [];

        if ($leaveRequest->status !== 'pending') {
            return response()->json(['message' => 'Request is not pending'], 400);
        }

        $step = (int) $leaveRequest->current_step;
        if (!isset($chain[$step]) || $chain[$step] !== $user->role) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        return DB::transaction(function () use ($request, $leaveRequest, $user, $chain, $step) {
            /** @var LeaveApproval $approval */
            $approval = LeaveApproval::where('leave_request_id', $leaveRequest->id)
                ->where('step_index', $step)
                ->lockForUpdate()
                ->firstOrFail();

            if ($approval->action !== null) {
                return response()->json(['message' => 'Already acted'], 400);
            }

            $approval->update([
                'acted_by' => $user->id,
                'action' => $request->action,
                'comment' => $request->comment,
                'acted_at' => now(),
            ]);

            if ($request->action === 'rejected') {
                $leaveRequest->update([
                    'status' => 'rejected',
                    'decision_at' => now(),
                ]);
            } else {
                $nextStep = $step + 1;
                if ($nextStep >= count($chain)) {
                    $leaveRequest->update([
                        'status' => 'approved',
                        'decision_at' => now(),
                        'current_step' => $nextStep,
                    ]);

                    // Apply balance usage
                    $year = (int) $leaveRequest->start_at->format('Y');
                    $balance = LeaveBalance::where('user_id', $leaveRequest->user_id)
                        ->where('leave_type_id', $leaveRequest->leave_type_id)
                        ->where('year', $year)
                        ->lockForUpdate()
                        ->first();

                    if ($balance) {
                        $balance->update([
                            'used_hours' => (int) $balance->used_hours + (int) $leaveRequest->duration_hours,
                        ]);
                    }
                } else {
                    $leaveRequest->update([
                        'current_step' => $nextStep,
                    ]);
                }
            }

            $leaveRequest->load(['leaveType', 'approvals.actor:id,name', 'user:id,name,employee_id,department']);
            return response()->json($leaveRequest);
        });
    }
}
