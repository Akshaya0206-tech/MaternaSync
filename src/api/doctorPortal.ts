import { api } from './client';
import type { JourneyEvent, CareTeamAppointment, CareTeamQuestion, Task, Handover, CareTeamNotification, CareTeamDocument, Referral, ReferralDetail } from './careTeamPortal';

export type { JourneyEvent, CareTeamAppointment, CareTeamQuestion, Task, Handover, CareTeamNotification, CareTeamDocument, Referral, ReferralDetail };

export interface TodayPatientRow {
  episodeId: string;
  patientName: string;
  appointmentTime: string | null;
  briefStatus: 'Ready' | 'Not Ready';
  pendingItemsSummary: string;
}

export interface DoctorDashboard {
  fullName: string;
  todaysPatients: number;
  briefsReady: number;
  questions: number;
  documentsToReview: number;
  followUps: number;
  draftsToApprove: number;
  todayPatientRows: TodayPatientRow[];
}

export interface DoctorPatientRow {
  episodeId: string;
  patientName: string;
  age: number | null;
  edd: string;
  nextAppointment: string | null;
  lastConsultation: string | null;
  openItems: number;
  questionCount: number;
}

export interface DocumentSummary {
  id: string;
  filename: string;
  status: string;
  statusLabel: string;
  documentDate: string | null;
}

export interface TodaysBrief {
  episodeId: string;
  patientName: string;
  age: number | null;
  gestationalAgeWeeks: number;
  gestationalAgeDays: number;
  edd: string;
  riskCategory: string;
  recentEvents: JourneyEvent[];
  pendingItems: Task[];
  patientQuestions: CareTeamQuestion[];
  nextAppointment: CareTeamAppointment | null;
  latestApprovedInfo: string;
  relevantDocuments: DocumentSummary[];
  status: 'DRAFT' | 'REVIEWED';
  generatedAt: string;
}

export interface Consultation {
  id: string;
  episodeId: string;
  patientName: string;
  doctorName: string;
  inputMode: string;
  status: 'in_progress' | 'documented';
  rawTranscript: string | null;
  audioAvailable: boolean;
  startedAt: string;
}

export interface ConsultationDraftContent {
  visitContext: string;
  documentedDiscussion: string;
  relevantInformation: string;
  followUpNextSteps: string;
}

export interface ConsultationDraft {
  id: string;
  consultationId: string;
  version: number;
  status: 'DRAFT' | 'REJECTED' | 'SUPERSEDED' | 'APPROVED';
  structuredContent: ConsultationDraftContent;
  createdAt: string;
}

export interface ApprovedConsultation {
  id: string;
  consultationId: string;
  draftId: string;
  approvedByName: string;
  approvedAt: string;
  finalContent: ConsultationDraftContent;
}

export interface DocumentationItem {
  consultationId: string;
  episodeId: string;
  patientName: string;
  date: string;
  type: string;
  authorName: string;
  status: string;
  latestDraftId: string | null;
  approvedId: string | null;
}

export interface DoctorProfile {
  fullName: string;
  email: string;
  role: string;
  specialty: string | null;
  facility: string | null;
}

// ---------- Dashboard ----------
export function fetchDashboard(): Promise<DoctorDashboard> {
  return api.get<DoctorDashboard>('/api/v2/doctor/dashboard');
}

// ---------- Patients ----------
export function fetchPatients(): Promise<DoctorPatientRow[]> {
  return api.get<DoctorPatientRow[]>('/api/v2/doctor/patients');
}

export function fetchEpisode(episodeId: string) {
  return api.get<import('./careTeamPortal').EpisodeDetail>(`/api/v2/episodes/${episodeId}`);
}

export function fetchEpisodeJourney(episodeId: string): Promise<JourneyEvent[]> {
  return api.get<JourneyEvent[]>(`/api/v2/doctor/episodes/${episodeId}/journey`);
}

export function fetchEpisodeAppointments(episodeId: string): Promise<CareTeamAppointment[]> {
  return api.get<CareTeamAppointment[]>(`/api/v2/doctor/episodes/${episodeId}/appointments`);
}

// ---------- Today's Brief ----------
export function fetchTodaysBrief(episodeId: string): Promise<TodaysBrief> {
  return api.get<TodaysBrief>(`/api/v2/doctor/episodes/${episodeId}/todays-brief`);
}

export function markBriefReviewed(episodeId: string): Promise<void> {
  return api.post(`/api/v2/doctor/episodes/${episodeId}/todays-brief/review`);
}

// ---------- Documents ----------
export function fetchDocuments(params: { episodeId?: string; status?: string } = {}): Promise<CareTeamDocument[]> {
  const q = new URLSearchParams();
  if (params.episodeId) q.set('episode_id', params.episodeId);
  if (params.status) q.set('status', params.status);
  const qs = q.toString();
  return api.get<CareTeamDocument[]>(`/api/v2/doctor/documents${qs ? `?${qs}` : ''}`);
}

export function fetchDocument(documentId: string): Promise<CareTeamDocument> {
  return api.get<CareTeamDocument>(`/api/v2/doctor/documents/${documentId}`);
}

export function documentFileUrl(documentId: string): string {
  return `/api/v2/doctor/documents/${documentId}/file`;
}

export function verifyDocument(documentId: string): Promise<CareTeamDocument> {
  return api.post<CareTeamDocument>(`/api/v2/doctor/documents/${documentId}/verify`);
}

export function rejectDocument(documentId: string, notes?: string): Promise<CareTeamDocument> {
  return api.post<CareTeamDocument>(`/api/v2/doctor/documents/${documentId}/reject`, { notes });
}

// ---------- Consultations ----------
export function fetchConsultations(episodeId?: string): Promise<Consultation[]> {
  const qs = episodeId ? `?episode_id=${episodeId}` : '';
  return api.get<Consultation[]>(`/api/v2/doctor/consultations${qs}`);
}

export function startConsultation(episodeId: string, inputMode: 'voice' | 'text'): Promise<Consultation> {
  return api.post<Consultation>('/api/v2/doctor/consultations', { episodeId, inputMode });
}

export function fetchConsultation(consultationId: string): Promise<Consultation> {
  return api.get<Consultation>(`/api/v2/doctor/consultations/${consultationId}`);
}

export function transcribeConsultation(consultationId: string, audioBlob: Blob): Promise<Consultation> {
  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.webm');
  return api.upload<Consultation>(`/api/v2/doctor/consultations/${consultationId}/transcribe`, formData);
}

export function updateTranscript(consultationId: string, rawTranscript: string): Promise<Consultation> {
  return api.patch<Consultation>(`/api/v2/doctor/consultations/${consultationId}`, { rawTranscript });
}

// ---------- Drafts ----------
export function fetchDrafts(consultationId: string): Promise<ConsultationDraft[]> {
  return api.get<ConsultationDraft[]>(`/api/v2/doctor/consultations/${consultationId}/drafts`);
}

export function generateDraft(consultationId: string): Promise<ConsultationDraft> {
  return api.post<ConsultationDraft>(`/api/v2/doctor/consultations/${consultationId}/drafts`);
}

export function fetchDraft(draftId: string): Promise<ConsultationDraft> {
  return api.get<ConsultationDraft>(`/api/v2/doctor/drafts/${draftId}`);
}

export function updateDraft(draftId: string, payload: Partial<ConsultationDraftContent>): Promise<ConsultationDraft> {
  return api.patch<ConsultationDraft>(`/api/v2/doctor/drafts/${draftId}`, payload);
}

export function rejectDraft(draftId: string): Promise<ConsultationDraft> {
  return api.post<ConsultationDraft>(`/api/v2/doctor/drafts/${draftId}/reject`);
}

export function approveDraft(draftId: string): Promise<ApprovedConsultation> {
  return api.post<ApprovedConsultation>(`/api/v2/doctor/drafts/${draftId}/approve`);
}

// ---------- Documentation history ----------
export function fetchDocumentation(): Promise<DocumentationItem[]> {
  return api.get<DocumentationItem[]>('/api/v2/doctor/documentation');
}

export function fetchApprovedVersion(consultationId: string): Promise<ApprovedConsultation> {
  return api.get<ApprovedConsultation>(`/api/v2/doctor/documentation/${consultationId}/approved`);
}

// ---------- Questions ----------
export function fetchQuestions(): Promise<CareTeamQuestion[]> {
  return api.get<CareTeamQuestion[]>('/api/v2/doctor/questions');
}

export function draftQuestionResponse(questionId: string, responseText: string): Promise<CareTeamQuestion> {
  return api.post<CareTeamQuestion>(`/api/v2/doctor/questions/${questionId}/draft`, { responseText });
}

export function approveQuestionResponse(questionId: string): Promise<CareTeamQuestion> {
  return api.post<CareTeamQuestion>(`/api/v2/doctor/questions/${questionId}/approve-response`);
}

// ---------- Follow-ups ----------
export function fetchFollowUps(status?: string): Promise<Task[]> {
  const qs = status ? `?status=${status}` : '';
  return api.get<Task[]>(`/api/v2/doctor/follow-ups${qs}`);
}

export function updateFollowUp(taskId: string, payload: { status?: string; dueDate?: string }): Promise<Task> {
  return api.patch<Task>(`/api/v2/doctor/follow-ups/${taskId}`, payload);
}

// ---------- Referrals ----------
// The Doctor originates a referral; Care Team coordinates it after that
// (see careTeamPortal.ts). The Doctor comes back only to review a
// received response and close the loop.
export function fetchReferrals(episodeId?: string): Promise<Referral[]> {
  const qs = episodeId ? `?episode_id=${episodeId}` : '';
  return api.get<Referral[]>(`/api/v2/doctor/referrals${qs}`);
}

export function fetchReferralDetail(referralId: string): Promise<ReferralDetail> {
  return api.get<ReferralDetail>(`/api/v2/doctor/referrals/${referralId}`);
}

export function createReferral(episodeId: string, payload: { title: string; description?: string; destination?: string; referredTo?: string; dueDate?: string }): Promise<Referral> {
  return api.post<Referral>(`/api/v2/doctor/episodes/${episodeId}/referrals`, { episodeId, ...payload });
}

export function closeReferral(referralId: string): Promise<Referral> {
  return api.post<Referral>(`/api/v2/doctor/referrals/${referralId}/close`);
}

// ---------- Handover ----------
export function fetchHandover(episodeId: string): Promise<Handover | null> {
  return api.get<Handover | null>(`/api/v2/doctor/handover/${episodeId}`);
}

export function generateHandover(episodeId: string): Promise<Handover> {
  return api.post<Handover>(`/api/v2/doctor/handover/${episodeId}/generate`);
}

export function updateHandover(handoverId: string, payload: Partial<Pick<Handover, 'context' | 'whatHappened' | 'whatRemains' | 'whoOwnsIt' | 'whatToDiscuss'>>): Promise<Handover> {
  return api.patch<Handover>(`/api/v2/doctor/handover/${handoverId}`, payload);
}

export function shareHandover(handoverId: string): Promise<Handover> {
  return api.post<Handover>(`/api/v2/doctor/handover/${handoverId}/share`);
}

// ---------- Updates ----------
export function fetchUpdates(): Promise<CareTeamNotification[]> {
  return api.get<CareTeamNotification[]>('/api/v2/doctor/updates');
}

export function markUpdateRead(notificationId: string): Promise<CareTeamNotification> {
  return api.patch<CareTeamNotification>(`/api/v2/doctor/updates/${notificationId}/read`);
}

// ---------- Profile ----------
export function fetchProfile(): Promise<DoctorProfile> {
  return api.get<DoctorProfile>('/api/v2/doctor/profile');
}

export function updateProfile(payload: { fullName?: string; specialty?: string; facility?: string }): Promise<DoctorProfile> {
  return api.patch<DoctorProfile>('/api/v2/doctor/profile', payload);
}
