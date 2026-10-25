import { api } from './client';
import type { Workspace } from './continuity';

/** What a woman can allow a trusted person to do. Only `appointments` is on unless she chooses more. */
export type Permission = 'appointments' | 'check_in' | 'care_plan' | 'questions' | 'emergency';
export type Permissions = Record<Permission, boolean>;

// ---------------------------------------------------------------- the woman's side
export interface TrustedPerson {
  id: string;
  displayName: string;
  relationship: string;
  status: 'INVITED' | 'ACTIVE' | 'REVOKED';
  permissions: Permissions;
  caregiverName: string | null;
  createdAt: string | null;
  acceptedAt: string | null;
  revokedAt: string | null;
  inviteExpiresAt: string | null;
  lastActivity: string | null;
  /** The last day they may help, or null for no end date. After it they see nothing until she extends it. */
  accessUntil: string | null;
  ended: boolean;
  /** Whether they get short WhatsApp reminders on their own number. */
  whatsapp: 'off' | 'waiting' | 'on';
  /** Only present in the answer to creating an invite or asking for a new code: it is shown once and never kept. */
  code?: string;
}

export interface TrustedPeople { permissions: Permission[]; items: TrustedPerson[] }
export interface TrustedActivity { at: string; title: string; details: string }

const MINE = '/api/v2/patient/caregivers';
export const listTrusted = () => api.get<TrustedPeople>(MINE);
export const inviteTrusted = (body: { displayName: string; relationship: string; permissions: Partial<Permissions>; accessUntil?: string | null }) => api.post<TrustedPerson>(MINE, body);
export const updateTrusted = (id: string, body: { displayName?: string; relationship?: string; permissions?: Partial<Permissions>; accessUntil?: string | null }) => api.patch<TrustedPerson>(`${MINE}/${id}`, body);
export const newInviteCode = (id: string) => api.post<TrustedPerson>(`${MINE}/${id}/new-code`);
export const removeTrusted = (id: string) => api.delete<TrustedPerson>(`${MINE}/${id}`);
export const trustedActivity = (id: string) => api.get<TrustedActivity[]>(`${MINE}/${id}/activity`);
/** Who has said they will take her to, or cannot come to, each upcoming visit (by visit id). */
export interface VisitHelpAnswer { name: string; status: 'WILL_TAKE' | 'CANNOT'; at: string | null }
export const visitHelpForMe = () => api.get<Record<string, VisitHelpAnswer[]>>(`${MINE}/visit-help`);

// ---------------------------------------------------------------- the trusted person's side
export interface Woman {
  linkId: string;
  womanName: string;
  relationship: string;
  displayName: string;
  permissions: Permissions;
  since: string | null;
  accessUntil: string | null;
  /** Past the end date she set: they see nothing until she extends it. */
  ended: boolean;
}
export interface HomeSummary extends Woman {
  upcoming?: { id: string; scheduledAt: string; type: string; location: string | null }[];
  lastCheckIn?: string | null;
}
export type VisitAnswer = 'WILL_TAKE' | 'CANNOT';
export interface CaregiverAppointment {
  id: string; scheduledAt: string; type: string; location: string | null; status: string;
  help: { status: VisitAnswer; updatedAt: string | null } | null;
}
export interface CaregiverWhatsAppStatus {
  available: boolean; mode: string; status: 'off' | 'waiting' | 'on'; number: string | null; expiresAt: string | null; visits: boolean; checkIns: boolean;
  /** Only in a demonstration, where no phone receives the code, so the screen shows it. */
  demoCode?: string | null;
}
export interface CaregiverCheckIn {
  id: string; recordedAt: string; systolic: number | null; diastolic: number | null; weightKg: number | null; symptoms: string; mood: string;
  adherence: string; skipped: boolean; enteredWithHelp: string | null;
}
export interface CaregiverQuestion { id: string; text: string; status: string; createdAt: string; replies: { text: string; at: string | null }[] }
export interface CaregiverNotification { id: string; title: string; body: string; createdAt: string | null; type: string }
export interface CaregiverEmergency {
  region: string | null;
  numbers: { number: string; label: string; kind: string }[];
  note: string;
  homeLabel: string | null;
  contactName: string | null;
  contactRelation: string | null;
  contactPhone: string | null;
  hospitalName: string | null;
  hospitalPhone: string | null;
  hospitalAddress: string | null;
}

const BASE = '/api/v2/caregiver';
export const listWomen = () => api.get<Woman[]>(`${BASE}/women`);
export const acceptInvite = (code: string) => api.post<Woman>(`${BASE}/accept`, { code });
export const getCaregiverLanguage = () => api.get<{ language: string }>(`${BASE}/preferences`);
export const setCaregiverLanguage = (language: string) => api.patch<{ language: string }>(`${BASE}/preferences`, { language });
export const caregiverNotifications = () => api.get<CaregiverNotification[]>(`${BASE}/notifications`);
export const caregiverHome = (link: string) => api.get<HomeSummary>(`${BASE}/${link}/home`);
export const caregiverAppointments = (link: string) => api.get<CaregiverAppointment[]>(`${BASE}/${link}/appointments`);
export const caregiverCheckIns = (link: string) => api.get<CaregiverCheckIn[]>(`${BASE}/${link}/check-ins`);
export const saveCaregiverCheckIn = (link: string, body: Record<string, unknown>) => api.post<{ id: string }>(`${BASE}/${link}/check-ins`, body);
/** The summaries and instructions a doctor approved and released to her: the same records, in the same shape, as her own Care Plan page. */
export const caregiverCarePlan = (link: string) => api.get<Workspace['outputs']>(`${BASE}/${link}/care-plan`);
export const caregiverQuestions = (link: string) => api.get<CaregiverQuestion[]>(`${BASE}/${link}/questions`);
export const askCaregiverQuestion = (link: string, questionText: string) => api.post<{ id: string }>(`${BASE}/${link}/questions`, { questionText });
export const caregiverEmergency = (link: string) => api.get<CaregiverEmergency>(`${BASE}/${link}/emergency`);
export const caregiverTalk = (link: string, message: string) => api.post<{ message: string }>(`${BASE}/${link}/talk-to-a-person`, { message });
export const setVisitHelp = (link: string, appointmentId: string, status: VisitAnswer) => api.put<{ status: VisitAnswer }>(`${BASE}/${link}/appointments/${appointmentId}/help`, { status });
export const clearVisitHelp = (link: string, appointmentId: string) => api.delete<{ status: null }>(`${BASE}/${link}/appointments/${appointmentId}/help`);
export const caregiverWhatsApp = (link: string) => api.get<CaregiverWhatsAppStatus>(`${BASE}/${link}/whatsapp`);
export const startCaregiverWhatsApp = (link: string, number: string) => api.post<CaregiverWhatsAppStatus>(`${BASE}/${link}/whatsapp/start`, { number });
export const confirmCaregiverWhatsApp = (link: string, code: string) => api.post<CaregiverWhatsAppStatus>(`${BASE}/${link}/whatsapp/confirm`, { code });
export const turnOffCaregiverWhatsApp = (link: string) => api.delete<CaregiverWhatsAppStatus>(`${BASE}/${link}/whatsapp`);
