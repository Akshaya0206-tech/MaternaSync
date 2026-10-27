import { api } from './client';

/** How many of the doctor's updates are unread (for the dot on the menu), and marking updates read. Her own updates only. */
export interface DoctorUnread {
  total: number;
}

export const fetchDoctorUnread = () => api.get<DoctorUnread>('/api/v2/doctor/updates/unread-summary');
export const markDoctorUpdatesRead = (body: { scope: 'all' } | { scope: 'ids'; ids: string[] }) =>
  api.post<DoctorUnread>('/api/v2/doctor/updates/mark-read', body);
