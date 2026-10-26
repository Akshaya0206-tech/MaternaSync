import { api } from './client';

export interface PatientAppointment {
  id: string;
  scheduledAt: string;
  appointmentType: string;
  location: string | null;
  status: string;
  doctorName: string | null;
  /** What she asked of the clinic about this confirmed visit. Only a request: the visit stays as it is until a doctor acts. */
  changeRequest?: { kind: 'cancel' | 'reschedule'; note: string | null; preferredAt: string | null; requestedAt: string } | null;
}

export interface PatientDashboard {
  fullName: string;
  gestationalAgeWeeks: number | null;
  gestationalAgeDays: number | null;
  edd: string | null;
  nextAppointment: PatientAppointment | null;
  actionNeeded: string | null;
  openQuestionsCount: number;
  recentCareTitle: string | null;
  recentCareDate: string | null;
  /** A visit she asked for that her doctor has not confirmed yet. */
  visitRequest: PatientAppointment | null;
  checkInToday: 'none' | 'recorded' | 'skipped';
  remindersDueCount: number;
  remindersDue: string[];
  answeredRecentlyCount: number;
}

export interface PatientDocument {
  id: string;
  filename: string;
  status: 'PROCESSING' | 'NEEDS_REVIEW' | 'VERIFIED' | 'REJECTED';
  statusLabel: string;
  documentDate: string | null;
  description: string | null;
  uploadedAt: string;
  /** What she said the file is when she uploaded it (lab_report, scan, ...); null for a record uploaded before types existed. */
  documentType: string | null;
}

export interface DocumentUploadResult {
  document: PatientDocument;
  message: string;
}

export interface QuestionResponse {
  id: string;
  responseText: string;
  responderRole: string;
  createdAt: string;
}

export interface PatientQuestion {
  id: string;
  questionText: string;
  status: 'NEW' | 'ASSIGNED' | 'WAITING_FOR_RESPONSE' | 'ANSWERED' | 'CLOSED';
  createdAt: string;
  responses: QuestionResponse[];
  /** Photos or reports she attached (documents of her own record). */
  attachments?: { id: string; filename: string }[];
  /** The earlier question this one follows up, when she asked again about an answer. */
  followUpOfId?: string | null;
  followUpOfText?: string | null;
}

/** What a piece of shorthand in an entry stands for (never what a result means). */
export interface WordMeaning {
  term: string;
  meaning: string;
}

export interface JourneyEvent {
  id: string;
  eventType: string;
  title: string;
  summary: string;
  eventDate: string;
  gestationalAgeWeeks: number;
  gestationalAgeDays: number;
  words: WordMeaning[];
}

export interface PatientNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  /** The page this update is about, such as /patient/questions, or null. */
  link: string | null;
}

export interface PatientProfile {
  fullName: string;
  email: string;
  dateOfBirth: string | null;
  mrn: string | null;
  phone: string | null;
}

export function fetchMyDashboard(): Promise<PatientDashboard> {
  // Her clock decides where "today" starts, so the page says how far it is behind UTC (India is -330).
  return api.get<PatientDashboard>(`/api/v2/patient/dashboard?tz_offset=${new Date().getTimezoneOffset()}`);
}

export function fetchMyDocuments(): Promise<PatientDocument[]> {
  return api.get<PatientDocument[]>('/api/v2/patient/documents');
}

export function uploadMyDocument(file: File, description: string, documentDate: string, documentType = ''): Promise<DocumentUploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  if (documentType) formData.append('document_type', documentType);
  if (description.trim()) formData.append('description', description.trim());
  if (documentDate.trim()) formData.append('document_date', documentDate.trim());
  return api.upload<DocumentUploadResult>('/api/v2/patient/documents', formData);
}

export function myDocumentFileUrl(documentId: string): string {
  return `/api/v2/patient/documents/${documentId}/file`;
}

export function fetchMyQuestions(): Promise<PatientQuestion[]> {
  return api.get<PatientQuestion[]>('/api/v2/patient/questions');
}

export function askMyQuestion(questionText: string, followUpOf?: string): Promise<PatientQuestion> {
  return api.post<PatientQuestion>('/api/v2/patient/questions', followUpOf ? { questionText, followUpOf } : { questionText });
}

export function fetchMyAppointments(): Promise<PatientAppointment[]> {
  return api.get<PatientAppointment[]>('/api/v2/patient/appointments');
}

export function fetchMyJourney(): Promise<JourneyEvent[]> {
  return api.get<JourneyEvent[]>('/api/v2/patient/journey');
}

export function fetchMyUpdates(): Promise<PatientNotification[]> {
  return api.get<PatientNotification[]>('/api/v2/patient/updates');
}

export function markMyUpdateRead(notificationId: string): Promise<PatientNotification> {
  return api.patch<PatientNotification>(`/api/v2/patient/updates/${notificationId}/read`);
}

export function fetchMyProfile(): Promise<PatientProfile> {
  return api.get<PatientProfile>('/api/v2/patient/profile');
}

export function updateMyProfile(payload: { fullName?: string; phone?: string; dateOfBirth?: string }): Promise<PatientProfile> {
  return api.patch<PatientProfile>('/api/v2/patient/profile', payload);
}
