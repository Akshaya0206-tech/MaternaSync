import { api } from './client';

export interface PatientAppointment {
  id: string;
  scheduledAt: string;
  appointmentType: string;
  location: string | null;
  status: string;
  doctorName: string | null;
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
}

export interface PatientDocument {
  id: string;
  filename: string;
  status: 'PROCESSING' | 'NEEDS_REVIEW' | 'VERIFIED' | 'REJECTED';
  statusLabel: string;
  documentDate: string | null;
  description: string | null;
  uploadedAt: string;
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
}

export interface JourneyEvent {
  id: string;
  eventType: string;
  title: string;
  summary: string;
  eventDate: string;
  gestationalAgeWeeks: number;
  gestationalAgeDays: number;
}

export interface PatientNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export interface PatientProfile {
  fullName: string;
  email: string;
  dateOfBirth: string | null;
  mrn: string | null;
  phone: string | null;
}

export function fetchMyDashboard(): Promise<PatientDashboard> {
  return api.get<PatientDashboard>('/api/v2/patient/dashboard');
}

export function fetchMyDocuments(): Promise<PatientDocument[]> {
  return api.get<PatientDocument[]>('/api/v2/patient/documents');
}

export function uploadMyDocument(file: File, description: string, documentDate: string): Promise<DocumentUploadResult> {
  const formData = new FormData();
  formData.append('file', file);
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

export function askMyQuestion(questionText: string): Promise<PatientQuestion> {
  return api.post<PatientQuestion>('/api/v2/patient/questions', { questionText });
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
