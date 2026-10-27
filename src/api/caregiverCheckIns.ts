import { api } from './client';
import type { CaregiverCheckIn } from './caregiver';

/** The trusted person's Daily Check-in and Questions extras: older check-ins, "Remind her", and a file or a follow-up on a question. */
const BASE = '/api/v2/caregiver';

export const CHECK_INS_PER_PAGE = 14;
export const MOST_QUESTION_FILES = 3;
export const MOST_QUESTION_FILE_BYTES = 10 * 1024 * 1024;

/** One page of her check-ins, newest first. `offset` asks for the next older ones. */
export const caregiverCheckInsPage = (link: string, offset: number) =>
  api.get<CaregiverCheckIn[]>(`${BASE}/${link}/check-ins?offset=${offset}&limit=${CHECK_INS_PER_PAGE}`);

export interface CheckInStatus { lastCheckInAt: string | null; nudgesLeft: number; nudgeLimit: number }
export const caregiverCheckInStatus = (link: string) => api.get<CheckInStatus>(`${BASE}/${link}/check-ins/status`);
export const remindHerToCheckIn = (link: string) => api.post<CheckInStatus>(`${BASE}/${link}/check-ins/nudge`);

/** Sent with a reference made on the phone, so a check-in that is sent twice (kept offline, then the reply was lost) is saved once. */
export const postCaregiverCheckIn = (link: string, body: Record<string, unknown>, clientRef: string) =>
  api.post<{ id: string }>(`${BASE}/${link}/check-ins`, { ...body, clientRef });

export const caregiverQuestionInfo = (link: string) => api.get<{ replyTime: string }>(`${BASE}/${link}/questions/info`);
export function attachCaregiverQuestionFile(link: string, questionId: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  return api.upload<{ id: string; filename: string }>(`${BASE}/${link}/questions/${questionId}/attachments`, form);
}
export const followUpCaregiverQuestion = (link: string, questionId: string, questionText: string) =>
  api.post<{ id: string }>(`${BASE}/${link}/questions/${questionId}/follow-up`, { questionText });
