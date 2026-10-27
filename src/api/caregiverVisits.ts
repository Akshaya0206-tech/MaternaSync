import { api } from './client';

const BASE = '/api/v2/caregiver';

/** "Remind her": one short note in her Updates about one of her reminders. `left` is how many of today's notes remain. */
export const remindHerAboutReminder = (link: string, reminderId: string) =>
  api.post<{ left: number; limit: number }>(`${BASE}/${link}/reminders/${reminderId}/nudge`);
