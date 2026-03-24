export interface User {
    id: number;
    name: string;
    email: string;
    role: 'management' | 'worker' | 'supervisor' | 'hr';
    employee_id: string;
    department: string;
    phone: string;
    is_active: boolean;
    avatar?: string;
    tasks_count?: number;
    created_at: string;
}

export interface LeaveType {
    id: number;
    name: string;
    code: string;
    is_paid: boolean;
    requires_attachment: boolean;
    is_active: boolean;
    approval_chain_roles: Array<'supervisor' | 'hr' | 'management'>;
    yearly_entitlement_hours: number;
    min_notice_hours: number;
    max_consecutive_hours: number | null;
    created_at: string;
    updated_at: string;
}

// Enum-style codes for default seeded types
export type LeaveTypeCode = 'ANNUAL' | 'SICK' | 'CASUAL' | 'UNPAID';

export interface LeaveRequest {
    id: number;
    user_id: number;
    leave_type_id: number;
    start_at: string;
    end_at: string;
    duration_hours: number;
    reason: string | null;
    attachment_path: string | null;
    status: 'pending' | 'approved' | 'rejected' | 'cancelled';
    current_step: number;
    submitted_at: string | null;
    decision_at: string | null;
    leave_type?: LeaveType;
    leaveType?: LeaveType;
    user?: Pick<User, 'id' | 'name' | 'employee_id' | 'department'>;
    approvals?: LeaveApproval[];
    created_at: string;
    updated_at: string;
}

export interface LeaveApproval {
    id: number;
    leave_request_id: number;
    step_index: number;
    required_role: 'supervisor' | 'hr' | 'management';
    acted_by: number | null;
    action: 'approved' | 'rejected' | null;
    comment: string | null;
    acted_at: string | null;
    actor?: Pick<User, 'id' | 'name'>;
    created_at: string;
    updated_at: string;
}

export interface LeaveBalance {
    id: number;
    user_id: number;
    leave_type_id: number;
    year: number;
    entitled_hours: number;
    used_hours: number;
    leaveType?: LeaveType;
    leave_type?: LeaveType;
    created_at: string;
    updated_at: string;
}

export interface TaskCompletionPhoto {
    id: number;
    task_id: number;
    photo_path: string;
    photo_url: string;
    created_at: string;
    updated_at: string;
}

export interface Task {
    id: number;
    title: string;
    description: string;
    assigned_to: number;
    assigned_by: number;
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'pending_approval';
    priority: 'low' | 'medium' | 'high';
    has_subtasks: boolean;
    parent_id: number | null;
    location: string | null;
    location_text?: string | null;
    location_lat?: number | null;
    location_lng?: number | null;
    place_id?: string | null;
    place_name?: string | null;
    place_address?: string | null;
    due_date: string | null;
    approval_notes: string | null;
    worker?: User;
    manager?: User;
    parent?: Pick<Task, 'id' | 'title'>;
    subtasks?: Task[];
    completion_photos?: TaskCompletionPhoto[];
    created_at: string;
    updated_at: string;
}

export interface TimeLog {
    id: number;
    user_id: number;
    task_id?: number;
    clock_in: string;
    clock_out?: string;
    duration_minutes?: number;
    notes?: string;
    user?: User;
    task?: Task;
    created_at?: string;
}

export interface Shift {
    id: number;
    user_id: number;
    shift_name: string;
    start_time: string;
    end_time: string;
    date: string;
    user?: User;
}

export interface Announcement {
    id: number;
    title: string;
    body: string;
    target: 'all' | 'workers' | 'management';
    created_by: number;
    creator?: User;
    created_at: string;
}

export interface DashboardStats {
    total_workers: number;
    active_workers: number;
    pending_tasks: number;
    in_progress: number;
    completed_today: number;
    clocked_in_now: number;
    recent_tasks: Task[];
    announcements: Announcement[];
}

export interface WorkerDashboard {
    pending_tasks: number;
    in_progress: number;
    completed_today: number;
    pending_approval: number;
    hours_this_week: number;
    is_clocked_in: boolean;
    todays_shift: Shift | null;
}

export interface MyHoursResponse {
    logs: TimeLog[];
    week_hours: number;
    month_hours: number;
}

export interface EngagementEvent {
    id: number;
    title: string;
    description: string | null;
    starts_at: string;
    ends_at: string | null;
    location_text: string | null;
    location_lat: number | null;
    location_lng: number | null;
    created_by: number;
    creator?: Pick<User, 'id' | 'name'>;
    present_count?: number;
    absent_count?: number;
    created_at: string;
    updated_at: string;
}

export interface EngagementAttendance {
    id: number;
    event_id: number;
    user_id: number;
    status: 'present' | 'absent';
    note: string | null;
    marked_by: number;
    marked_at: string;
    user?: Pick<User, 'id' | 'name' | 'employee_id' | 'department'>;
    marker?: Pick<User, 'id' | 'name'>;
    created_at: string;
    updated_at: string;
}

export interface EngagementEventDetailResponse {
    event: EngagementEvent & { attendances?: EngagementAttendance[] };
    attendance: {
        present: number;
        absent: number;
        total_marked: number;
    };
}

export interface MyTasksResponse {
    tasks: Task[];
    subtasks: Task[];
}