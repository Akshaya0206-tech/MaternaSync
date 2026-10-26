import { api } from './client';

/** What she has not seen yet: everything, and the part that belongs on My Questions and on My Care Plan. */
export interface UnreadSummary {
  total: number;
  questions: number;
  carePlan: number;
}

export type ReadScope = 'all' | 'questions' | 'care_plan';

export const fetchUnreadSummary = () => api.get<UnreadSummary>('/api/v2/patient/updates/unread-summary');
export const markUpdatesRead = (scope: ReadScope) => api.post<UnreadSummary>('/api/v2/patient/updates/mark-read', { scope });

export type ConsentPurpose = 'reminders' | 'approved_documents';

/** The text a recipient would be sent, in her language, as the server words it. */
export interface ConsentPreview {
  purpose: ConsentPurpose;
  language: string;
  text: string;
  viaTemplate: boolean;
}

export const fetchConsentPreview = (purpose: ConsentPurpose) => api.get<ConsentPreview>(`/api/v2/patient/consent-preview?purpose=${purpose}`);
