import { api } from './client';

export interface AssistantStatus {
  mode: 'off' | 'shadow' | 'assist';
  provider: 'rules' | 'claude';
  model: string | null;
  careTeamEnabled: boolean;
  /** Handover is paused in the app, so the assistant prepares no handover drafts. */
  handoverPaused: boolean;
  open: number;
  urgent: number;
  proposals: number;
  handledToday: number;
  /** A doctor paused everything: new work waits (a warning-sign question still gets the fixed emergency message). */
  paused: boolean;
  pausedBy: string | null;
  /** Routine steps wait for a doctor's approval first. */
  reviewAll: boolean;
  pausedPatients: { episodeId: string; patientName: string }[];
  /** Jobs queued and not yet run. */
  waiting: number;
}

export interface AssistantItem {
  id: string;
  episodeId: string;
  patientName: string;
  kind: 'proposal' | 'attention';
  urgency: 'urgent' | 'normal';
  title: string;
  summary: string;
  recommendedAction: string;
  proposedTool: string | null;
  preview: string | null;
  status: 'OPEN' | 'APPROVED' | 'DISMISSED' | 'ACKNOWLEDGED';
  createdAt: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
}

export interface AssistantAction {
  id: string;
  episodeId: string;
  executedBy: string | null;
  /** The step ran and can still be reversed by a doctor. */
  undoable: boolean;
  undoneAt: string | null;
  undoneBy: string | null;
  undoNote: string | null;
  createdAt: string | null;
  patientName: string;
  workflow: string;
  tool: string;
  tier: string;
  policy: string;
  status: string;
  reason: string;
  result: string;
  provider: string | null;
  mode: string | null;
}

/** The clinic's booking rules. Weekdays count from Monday = 0; times are the clinic's own clock. */
export interface SchedulingRules {
  days: number[];
  start: string;
  end: string;
  minutes: number;
  noticeHours: number;
  offsetMinutes: number;
  graceHours: number;
  weekdays: string[];
}

/** Plain counts for a doctor's own patients, worked out by code on the server. */
export interface AssistantSummary {
  days: number;
  from: string;
  to: string;
  questions: { received: number; answered: number; hoursToReply: number | null };
  documents: { uploaded: number; verified: number; hoursToVerify: number | null };
  checkIns: { recorded: number; patientsOverdue: number };
  tasks: { open: number; overdue: number };
  visits: { waitingForAnswer: number; completed: number; missed: number };
  assistant: { stepsDone: number; proposed: number; approved: number; dismissed: number; undone: number };
}

const BASE = '/api/v2/assistant';
export const getSchedulingRules = () => api.get<SchedulingRules>(`${BASE}/scheduling-rules`);
export const saveSchedulingRules = (rules: SchedulingRules) => {
  const { weekdays: _weekdays, ...body } = rules;
  return api.put<SchedulingRules>(`${BASE}/scheduling-rules`, body);
};
export const assistantSummary = (days = 7) => api.get<AssistantSummary>(`${BASE}/summary?days=${days}`);
export const assistantStatus = () => api.get<AssistantStatus>(`${BASE}/status`);
export const assistantItems = (scope: 'open' | 'all') => api.get<AssistantItem[]>(`${BASE}/exceptions?scope=${scope}`);
export const decideAssistantItem = (id: string, decision: 'approve' | 'dismiss' | 'acknowledge', note = '') =>
  api.post<AssistantItem & { message: string }>(`${BASE}/exceptions/${id}/decide`, { decision, note });
export const assistantActivity = () => api.get<AssistantAction[]>(`${BASE}/activity`);
export const changeAssistantSettings = (body: { paused?: boolean; reviewAll?: boolean }) => api.patch<AssistantStatus>(`${BASE}/settings`, body);
export const pauseAssistantForPatient = (episodeId: string) => api.post<AssistantStatus>(`${BASE}/patients/${episodeId}/pause`);
export const resumeAssistantForPatient = (episodeId: string) => api.post<AssistantStatus>(`${BASE}/patients/${episodeId}/resume`);
export const undoAssistantAction = (id: string, note: string) => api.post<AssistantAction & { message: string }>(`${BASE}/actions/${id}/undo`, { note });
export const runAssistantNow = () => api.post<{ queued: number } & Record<string, number>>(`${BASE}/run-now`);
/** The patient's own button: always reaches a doctor, whatever mode the assistant is in. */
export const talkToAPerson = (message: string) => api.post<{ message: string }>(`${BASE}/talk-to-a-person`, { message });
