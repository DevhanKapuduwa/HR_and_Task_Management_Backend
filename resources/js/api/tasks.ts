import api from './axios';
import { Task } from '../types';

export const taskApi = {
    getAll: (filters?: { status?: string; worker_id?: number }) =>
        api.get<Task[]>('/tasks', { params: filters }).then(r => r.data),

    create: (data: {
        title: string;
        description?: string;
        worker_id: number;
        priority: string;
        location?: string;
        due_date?: string;
    }) => api.post<Task>('/tasks', data).then(r => r.data),

    update: (id: number, data: Partial<Task>) =>
        api.put<Task>(`/tasks/${id}`, data).then(r => r.data),

    updateStatus: (id: number, status: Task['status']) =>
        api.patch(`/tasks/${id}/status`, { status }).then(r => r.data),

    delete: (id: number) =>
        api.delete(`/tasks/${id}`).then(r => r.data),

    // Worker facing
    myTasks: () =>
        api.get<Task[]>('/worker/my-tasks').then(r => r.data),

    start: (id: number) =>
        api.patch(`/worker/tasks/${id}/start`).then(r => r.data),

    complete: (id: number) =>
        api.patch(`/worker/tasks/${id}/complete`).then(r => r.data),
};