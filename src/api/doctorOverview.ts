import { api } from './client';
import type { Task } from './doctorPortal';

/** A follow-up task with the plain date arithmetic the page needs (worked out by the server, in UTC, like the Dashboard and the clinic overview). */
export interface FollowUp extends Task {
  /** Whole days after the due date. Null when the task is not overdue. */
  daysOverdue: number | null;
  /** Due today or earlier. */
  isDue: boolean;
  ownedByYou: boolean;
}

export interface FollowUpsOverview {
  today: string;
  /** Open tasks assigned to the signed-in doctor: the number on the Dashboard's "Follow-ups owned by you" tile. */
  mine: FollowUp[];
  /** Open tasks for her patients that someone else owns, or nobody does. */
  others: FollowUp[];
}

export const fetchFollowUpsOverview = () => api.get<FollowUpsOverview>('/api/v2/doctor/follow-ups/overview');

/** Records that the clinic summary was printed or downloaded. */
export const recordClinicExport = (body: { kind: 'print' | 'csv'; fromDate: string | null; toDate: string | null; patients: number }) =>
  api.post<{ recorded: boolean }>('/api/v2/continuity/clinic/export', body);
