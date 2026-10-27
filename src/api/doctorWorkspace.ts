import { api } from './client';

// The doctor's view of one patient's audit trail and of her visit-change requests that wait for an answer (see backend/app/routers/audit_trail.py).
export type AuditWho = 'patient' | 'doctor' | 'trusted_person' | 'assistant' | 'other';
export type AuditKind = 'checkins' | 'documents' | 'questions' | 'visits' | 'consents' | 'trusted' | 'approved' | 'account' | 'other';

export interface AuditRow {
  id: string;
  at: string | null;
  who: AuditWho;
  whoName: string | null;
  whoRole: string;
  /** A care-team account whose login is switched off. */
  loginOff: boolean;
  action: string;
  kind: AuditKind;
  summary: string | null;
  objectType: string | null;
  objectLabel: string | null;
  details: string;
  changes: { field: string; before: string | null; after: string | null }[];
}

export interface AuditPage {
  items: AuditRow[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface AuditFilters {
  dateFrom?: string;
  dateTo?: string;
  who?: AuditWho | '';
  kind?: AuditKind | '';
  includeViews?: boolean;
}

const query = (filters: AuditFilters, limit: number, offset: number) => {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset), tz_offset: String(new Date().getTimezoneOffset()) });
  if (filters.dateFrom) params.set('date_from', filters.dateFrom);
  if (filters.dateTo) params.set('date_to', filters.dateTo);
  if (filters.who) params.set('who', filters.who);
  if (filters.kind) params.set('kind', filters.kind);
  if (filters.includeViews) params.set('include_views', 'true');
  return params.toString();
};

export const fetchAuditTrail = (episodeId: string, filters: AuditFilters, limit = 25, offset = 0) =>
  api.get<AuditPage>(`/api/v2/doctor/episodes/${episodeId}/audit-trail?${query(filters, limit, offset)}`);

/** Recorded before a copy is printed or saved, so taking a copy leaves a trace; if it fails, no copy is made. */
export const noteAuditExport = (episodeId: string, kind: 'print' | 'csv', count: number, filters: Record<string, string>) =>
  api.post<{ recorded: boolean }>(`/api/v2/doctor/episodes/${episodeId}/audit-trail/export`, { kind, count, filters });

export interface OpenVisitChange {
  appointmentId: string;
  taskId: string;
  kind: 'reschedule' | 'cancel';
  visitType: string;
  visitAt: string;
  preferredAt: string | null;
  requestedAt: string | null;
  note: string;
  title: string;
}

export const fetchOpenVisitChanges = (episodeId: string) => api.get<OpenVisitChange[]>(`/api/v2/doctor/episodes/${episodeId}/open-visit-changes`);
