import { api } from './client';

export type SetupKey = 'clinic_contact' | 'booking_rules' | 'reply_time' | 'followup_rules' | 'hospitals' | 'education';

export interface SetupItem {
  key: SetupKey;
  done: boolean;
  count?: number;
}

export interface SetupStatus {
  items: SetupItem[];
  done: number;
  total: number;
}

export type NeedsYouKind = 'question' | 'document' | 'draft' | 'document_draft' | 'proposal';

export interface NeedsYouItem {
  kind: NeedsYouKind;
  episodeId: string;
  patientName: string;
  title: string;
  waitingSince: string;
  to: string;
}

export interface NeedsYou {
  items: NeedsYouItem[];
  total: number;
}

/** Which parts of the clinic's own setup are still empty (yes/no and counts; nothing about any patient). */
export const fetchSetupStatus = () => api.get<SetupStatus>('/api/v2/doctor/setup-status');

/** What is waiting for this doctor, oldest first. */
export const fetchNeedsYou = () => api.get<NeedsYou>('/api/v2/doctor/needs-you');
