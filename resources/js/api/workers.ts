import { User, WorkerDashboard } from '../types';
import api from './axios';

export const workerApi = {
    getAll: () =>
        api.get<User[]>('/workers').then(r => r.data),

    create: (data: Partial<User> & { password: string }) =>
        api.post<User>('/workers', data).then(r => r.data),

    update: (id: number, data: Partial<User> & { password?: string }) =>
        api.put<User>(`/workers/${id}`, data).then(r => r.data),

    delete: (id: number) =>
        api.delete(`/workers/${id}`).then(r => r.data),

    toggleStatus: (id: number) =>
        api.patch(`/workers/${id}/toggle-status`).then(r => r.data),

    // Worker self-service
    dashboard: () =>
        api.get<WorkerDashboard>('/worker/dashboard').then(r => r.data),

    myShift: () =>
        api.get('/worker/my-shift').then(r => r.data),
};