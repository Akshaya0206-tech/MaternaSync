import { api } from './client';

export interface NeedsAttentionItem {
  type: 'document' | 'question' | 'referral' | 'task';
  title: string;
  patientName: string;
  link: string;
  createdAt: string;
}

export interface CareTeamDashboard {
  fullName: string;
  activePatients: number;
  documentsToReview: number;
  patientQuestions: number;
  openTasks: number;
  pendingReferrals: number;
  needsAttention: NeedsAttentionItem[];
}

export interface CareTeamPatientRow {
  episodeId: string;
  patientName: string;
  age: number | null;
  edd: string;
  lastActivity: string | null;
  openTasks: number;
  openQuestions: number;
  documentsNeedingReview: number;
}

export interface Extraction {
  recordType: string;
  visitType: string;
  eventDate: string;
  facility: string;
  provider: string;
  department: string;
  patientNameFound: string;
  mrnFound: string;
  gestationalAge: string;
  fieldStatus: Record<string, { value: string | null; status: string }>;
}

export interface DocumentReviewEntry {
  id: string;
  action: string;
  reviewerName: string;
  reviewerRole: string;
  notes: string | null;
  reviewedAt: string;
}

export interface CareTeamDocument {
  id: string;
  episodeId: string;
  patientName: string;
  filename: string;
  description: string | null;
  documentDate: string | null;
  uploadedByName: string;
  uploadedByRole: string;
  uploadedAt: string;
  status: 'PROCESSING' | 'NEEDS_REVIEW' | 'VERIFIED' | 'REJECTED';
  statusLabel: string;
  extraction: Extraction | null;
  reviews: DocumentReviewEntry[];
}

export interface DocumentEditPayload {
  description?: string;
  documentDate?: string;
  recordType?: string;
  visitType?: string;
  eventDate?: string;
  facility?: string;
  provider?: string;
  department?: string;
  patientNameFound?: string;
  mrnFound?: string;
  gestationalAge?: string;
}

export interface CareTeamQuestionResponse {
  id: string;
  responseText: string;
  responderRole: string;
  createdAt: string;
}

export interface CareTeamQuestion {
  id: string;
  episodeId: string;
  patientName: string;
  questionText: string;
  status: 'NEW' | 'ASSIGNED' | 'WAITING_FOR_RESPONSE' | 'ANSWERED' | 'CLOSED';
  isClinical: boolean;
  assignedToName: string | null;
  createdAt: string;
  responses: CareTeamQuestionResponse[];
}

export interface Task {
  id: string;
  episodeId: string;
  patientName: string;
  title: string;
  description: string;
  ownerName: string | null;
  createdByName: string;
  dueDate: string | null;
  priority: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'WAITING' | 'COMPLETED' | 'CANCELLED';
  sourceType: string | null;
  sourceId: string | null;
  waitingFor: string | null;
  waitingSince: string | null;
  createdAt: string;
}

export interface TaskCreatePayload {
  episodeId: string;
  title: string;
  description?: string;
  ownerUserId?: string;
  dueDate?: string;
  priority?: string;
}

export interface TaskUpdatePayload {
  title?: string;
  description?: string;
  ownerUserId?: string;
  dueDate?: string;
  priority?: string;
  status?: string;
}

export type ReferralStatus = 'DRAFT' | 'SENT' | 'ACKNOWLEDGED' | 'APPOINTMENT_SCHEDULED' | 'RESPONSE_RECEIVED' | 'CLOSED';

export interface Referral {
  id: string;
  referenceCode: string | null;
  episodeId: string;
  patientName: string;
  title: string;
  description: string;
  referredTo: string | null;
  destination: string | null;
  status: ReferralStatus;
  ownerName: string | null;
  dueDate: string | null;
  waitingFor: string | null;
  waitingSince: string | null;
  sentAt: string | null;
  acknowledgedAt: string | null;
  appointmentDate: string | null;
  appointmentTime: string | null;
  externalProvider: string | null;
  responseReceivedAt: string | null;
  doctorReviewedAt: string | null;
  createdAt: string;
}

export interface ReferralCreatePayload {
  episodeId: string;
  title: string;
  description?: string;
  destination?: string;
  referredTo?: string;
  dueDate?: string;
}

export interface ReferralUpdatePayload {
  title?: string;
  description?: string;
  referredTo?: string;
  ownerUserId?: string;
  dueDate?: string;
}

export interface ReferralEvent {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  note: string | null;
  actorName: string | null;
  actorSource: string;
  createdAt: string;
}

export interface CommunicationEvent {
  id: string;
  type: string;
  direction: 'INBOUND' | 'OUTBOUND';
  senderLabel: string | null;
  recipientLabel: string | null;
  subject: string | null;
  content: string;
  status: string;
  source: string;
  externalReference: string | null;
  createdAt: string;
  receivedAt: string | null;
}

export interface ReferralDetail {
  referral: Referral;
  events: ReferralEvent[];
  communications: CommunicationEvent[];
  relatedTask: Task | null;
  documents: PatientDocument[];
}

export interface PatientDocument {
  id: string;
  filename: string;
  status: string;
  statusLabel: string;
  documentDate: string | null;
  description: string | null;
  uploadedAt: string;
}

export interface Handover {
  id: string;
  episodeId: string;
  patientName: string;
  context: string;
  whatHappened: string;
  whatRemains: string;
  whoOwnsIt: string;
  whatToDiscuss: string;
  status: 'DRAFT' | 'FINAL';
  generatedByAi: boolean;
  createdAt: string;
}

export interface CareTeamNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export interface CareTeamProfile {
  fullName: string;
  email: string;
  role: string;
  title: string | null;
  facility: string | null;
}

export interface EpisodeDetail {
  id: string;
  patientUserId: string;
  patientName: string;
  mrn: string | null;
  age: number | null;
  dob: string | null;
  edd: string;
  gestationalAgeWeeks: number;
  gestationalAgeDays: number;
  gravidaPara: string;
  bloodType: string;
  allergies: string[];
  riskCategory: string;
  riskNotes: string;
  facility: string;
  isReadyForTodaysBrief: boolean;
  createdAt: string;
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

export interface CareTeamAppointment {
  id: string;
  scheduledAt: string;
  appointmentType: string;
  location: string | null;
  status: string;
  doctorName: string | null;
}

// ---------- Dashboard ----------
export function fetchDashboard(): Promise<CareTeamDashboard> {
  return api.get<CareTeamDashboard>('/api/v2/care-team/dashboard');
}

// ---------- Patients ----------
export function fetchPatients(): Promise<CareTeamPatientRow[]> {
  return api.get<CareTeamPatientRow[]>('/api/v2/care-team/patients');
}

export function fetchEpisode(episodeId: string): Promise<EpisodeDetail> {
  return api.get<EpisodeDetail>(`/api/v2/episodes/${episodeId}`);
}

export function fetchEpisodeJourney(episodeId: string): Promise<JourneyEvent[]> {
  return api.get<JourneyEvent[]>(`/api/v2/care-team/episodes/${episodeId}/journey`);
}

export function fetchEpisodeAppointments(episodeId: string): Promise<CareTeamAppointment[]> {
  return api.get<CareTeamAppointment[]>(`/api/v2/care-team/episodes/${episodeId}/appointments`);
}

// ---------- Documents ----------
export function fetchDocuments(params: { episodeId?: string; status?: string } = {}): Promise<CareTeamDocument[]> {
  const q = new URLSearchParams();
  if (params.episodeId) q.set('episode_id', params.episodeId);
  if (params.status) q.set('status', params.status);
  const qs = q.toString();
  return api.get<CareTeamDocument[]>(`/api/v2/care-team/documents${qs ? `?${qs}` : ''}`);
}

export function fetchDocument(documentId: string): Promise<CareTeamDocument> {
  return api.get<CareTeamDocument>(`/api/v2/care-team/documents/${documentId}`);
}

export function documentFileUrl(documentId: string): string {
  return `/api/v2/care-team/documents/${documentId}/file`;
}

export function editDocument(documentId: string, payload: DocumentEditPayload): Promise<CareTeamDocument> {
  return api.patch<CareTeamDocument>(`/api/v2/care-team/documents/${documentId}`, payload);
}

export function verifyDocument(documentId: string, notes?: string): Promise<CareTeamDocument> {
  return api.post<CareTeamDocument>(`/api/v2/care-team/documents/${documentId}/verify`, { notes });
}

export function rejectDocument(documentId: string, notes?: string): Promise<CareTeamDocument> {
  return api.post<CareTeamDocument>(`/api/v2/care-team/documents/${documentId}/reject`, { notes });
}

export function sendDocumentToDoctor(documentId: string, notes?: string): Promise<CareTeamDocument> {
  return api.post<CareTeamDocument>(`/api/v2/care-team/documents/${documentId}/send-to-doctor`, { notes });
}

export function uploadDocumentFallback(episodeId: string, file: File, description: string): Promise<CareTeamDocument> {
  const formData = new FormData();
  formData.append('file', file);
  if (description.trim()) formData.append('description', description.trim());
  return api.upload<CareTeamDocument>(`/api/v2/care-team/episodes/${episodeId}/documents`, formData);
}

// ---------- Questions ----------
export function fetchQuestions(episodeId?: string): Promise<CareTeamQuestion[]> {
  const qs = episodeId ? `?episode_id=${episodeId}` : '';
  return api.get<CareTeamQuestion[]>(`/api/v2/care-team/questions${qs}`);
}

export function logQuestionOnBehalfOfPatient(episodeId: string, questionText: string): Promise<CareTeamQuestion> {
  return api.post<CareTeamQuestion>(`/api/v2/care-team/episodes/${episodeId}/questions`, { questionText });
}

export function respondToQuestion(questionId: string, responseText: string): Promise<CareTeamQuestion> {
  return api.post<CareTeamQuestion>(`/api/v2/care-team/questions/${questionId}/respond`, { responseText });
}

export function assignQuestionToDoctor(questionId: string): Promise<CareTeamQuestion> {
  return api.post<CareTeamQuestion>(`/api/v2/care-team/questions/${questionId}/assign-doctor`);
}

export function closeQuestion(questionId: string): Promise<CareTeamQuestion> {
  return api.post<CareTeamQuestion>(`/api/v2/care-team/questions/${questionId}/close`);
}

// ---------- Tasks ----------
export function fetchTasks(params: { episodeId?: string; status?: string } = {}): Promise<Task[]> {
  const q = new URLSearchParams();
  if (params.episodeId) q.set('episode_id', params.episodeId);
  if (params.status) q.set('status', params.status);
  const qs = q.toString();
  return api.get<Task[]>(`/api/v2/care-team/tasks${qs ? `?${qs}` : ''}`);
}

export function createTask(payload: TaskCreatePayload): Promise<Task> {
  return api.post<Task>('/api/v2/care-team/tasks', payload);
}

export function updateTask(taskId: string, payload: TaskUpdatePayload): Promise<Task> {
  return api.patch<Task>(`/api/v2/care-team/tasks/${taskId}`, payload);
}

// ---------- Referrals ----------
// Referrals are created by the Doctor (see doctorPortal.ts createReferral)
// — Care Team coordinates an existing referral through its lifecycle via
// the dedicated action endpoints below, never a generic status PATCH.
export function fetchReferrals(params: { episodeId?: string; status?: string } = {}): Promise<Referral[]> {
  const q = new URLSearchParams();
  if (params.episodeId) q.set('episode_id', params.episodeId);
  if (params.status) q.set('status', params.status);
  const qs = q.toString();
  return api.get<Referral[]>(`/api/v2/care-team/referrals${qs ? `?${qs}` : ''}`);
}

export function fetchReferralDetail(referralId: string): Promise<ReferralDetail> {
  return api.get<ReferralDetail>(`/api/v2/care-team/referrals/${referralId}`);
}

export function updateReferral(referralId: string, payload: ReferralUpdatePayload): Promise<Referral> {
  return api.patch<Referral>(`/api/v2/care-team/referrals/${referralId}`, payload);
}

export function sendReferral(referralId: string): Promise<Referral> {
  return api.post<Referral>(`/api/v2/care-team/referrals/${referralId}/send`);
}

export function acknowledgeReferral(referralId: string, note?: string, externalReference?: string): Promise<Referral> {
  return api.post<Referral>(`/api/v2/care-team/referrals/${referralId}/acknowledge`, { note, externalReference });
}

export function recordReferralAppointment(referralId: string, appointmentDate: string, appointmentTime?: string, externalProvider?: string): Promise<Referral> {
  return api.post<Referral>(`/api/v2/care-team/referrals/${referralId}/appointment`, { appointmentDate, appointmentTime, externalProvider });
}

export function recordReferralResponse(referralId: string, responseText: string): Promise<Referral> {
  return api.post<Referral>(`/api/v2/care-team/referrals/${referralId}/response`, { responseText });
}

export function uploadReferralDocument(referralId: string, file: File, description: string): Promise<CareTeamDocument> {
  const formData = new FormData();
  formData.append('file', file);
  if (description.trim()) formData.append('description', description.trim());
  return api.upload<CareTeamDocument>(`/api/v2/care-team/referrals/${referralId}/documents`, formData);
}

// ---------- Handover ----------
export function fetchHandover(episodeId: string): Promise<Handover | null> {
  return api.get<Handover | null>(`/api/v2/care-team/handover/${episodeId}`);
}

export function generateHandover(episodeId: string): Promise<Handover> {
  return api.post<Handover>(`/api/v2/care-team/handover/${episodeId}/generate`);
}

export function updateHandover(handoverId: string, payload: Partial<Pick<Handover, 'context' | 'whatHappened' | 'whatRemains' | 'whoOwnsIt' | 'whatToDiscuss'>>): Promise<Handover> {
  return api.patch<Handover>(`/api/v2/care-team/handover/${handoverId}`, payload);
}

export function shareHandover(handoverId: string): Promise<Handover> {
  return api.post<Handover>(`/api/v2/care-team/handover/${handoverId}/share`);
}

// ---------- Updates ----------
export function fetchUpdates(): Promise<CareTeamNotification[]> {
  return api.get<CareTeamNotification[]>('/api/v2/care-team/updates');
}

export function markUpdateRead(notificationId: string): Promise<CareTeamNotification> {
  return api.patch<CareTeamNotification>(`/api/v2/care-team/updates/${notificationId}/read`);
}

// ---------- Profile ----------
export function fetchProfile(): Promise<CareTeamProfile> {
  return api.get<CareTeamProfile>('/api/v2/care-team/profile');
}

export function updateProfile(payload: { fullName?: string; title?: string; facility?: string }): Promise<CareTeamProfile> {
  return api.patch<CareTeamProfile>('/api/v2/care-team/profile', payload);
}
