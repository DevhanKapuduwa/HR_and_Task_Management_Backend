export interface User {
    id: number;
    name: string;
    email: string;
    role: 'management' | 'worker';
    employee_id: string;
    department: string;
    phone: string;
    is_active: boolean;
    avatar?: string;
    tasks_count?: number;
    created_at: string;
}

export interface Task {
    id: number;
    title: string;
    description: string;
    assigned_to: number;
    assigned_by: number;
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    priority: 'low' | 'medium' | 'high';
    location: string;
    due_date: string;
    worker?: User;
    manager?: User;
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
    hours_this_week: number;
    is_clocked_in: boolean;
    todays_shift: Shift | null;
}

export interface MyHoursResponse {
    logs: TimeLog[];
    week_hours: number;
    month_hours: number;
}