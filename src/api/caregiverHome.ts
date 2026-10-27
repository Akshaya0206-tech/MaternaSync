import { api } from './client';

const BASE = '/api/v2/caregiver';

/** What is going on today for one woman. A part is missing when she has not allowed the person to see it. */
export interface CaregiverToday {
  checkIn?: 'none' | 'recorded' | 'skipped';
  remindersDue?: number;
  answeredRecently?: number;
  nextVisit?: { id: string; scheduledAt: string; type: string; location: string | null } | null;
}

/** The phone's own clock decides where "today" starts, the same as on her Home page. */
export const caregiverToday = (link: string) => api.get<CaregiverToday>(`${BASE}/${link}/today?tz_offset=${new Date().getTimezoneOffset()}`);
/** Stop helping her for good. She is told; she can invite them again. */
export const stopHelping = (link: string) => api.post<{ stopped: boolean }>(`${BASE}/${link}/stop-helping`);

/** One of the person's updates: which woman it is about (when they look after more than one), whether it is unread and the page it leads to, if she has allowed that page. */
export interface CaregiverUpdate {
  id: string;
  title: string;
  body: string;
  createdAt: string | null;
  type: string;
  isRead: boolean;
  linkId: string | null;
  womanName: string | null;
  link: string | null;
}
export interface CaregiverUnread {
  total: number;
  /** Unread updates for each woman, by link id. */
  byLink: Record<string, number>;
  /** Unread updates that belong to none of the women they look after right now. */
  unassigned: number;
}

export const caregiverUpdates = () => api.get<CaregiverUpdate[]>(`${BASE}/notifications`);
export const caregiverUnread = () => api.get<CaregiverUnread>(`${BASE}/updates-summary`);
export const markCaregiverUpdateRead = (id: string) => api.patch<CaregiverUpdate>(`${BASE}/notifications/${id}/read`);
export const markAllCaregiverUpdatesRead = () => api.post<CaregiverUnread>(`${BASE}/notifications/read-all`);
