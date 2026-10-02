import { api } from './client';
import type {
  PatientEpisode,
  PatientRecord,
  PendingWorkflowItem,
  ActivityLogEntry,
  AdministrativeDocCheck,
  RecordCategory,
  WorkflowItemType,
  WorkflowStatus,
  WorkflowPriority,
  VerificationStatus,
  ActivityLogAction
} from '../types/patient';

export interface PatientSummary {
  id: string;
  patientName: string;
  mrn: string | null;
  age: number | null;
  edd: string;
  gestationalAgeWeeks: number;
  gestationalAgeDays: number;
  riskCategory: 'routine' | 'moderate' | 'high_risk';
  recordCount: number;
  openWorkflowCount: number;
}

interface PatientDto {
  id: string;
  patientName: string;
  mrn: string | null;
  age: number | null;
  dob: string | null;
  gestationalAgeWeeks: number;
  gestationalAgeDays: number;
  edd: string;
  gravidaPara: string;
  bloodType: string;
  allergies: string[];
  primaryClinician: string;
  episodeStartDate: string;
  riskCategory: 'routine' | 'moderate' | 'high_risk';
  riskNotes: string;
  facility: string;
  isReadyForTodayBrief: boolean;
  handoffTimestamp: string | null;
  handoffNotes: string | null;
  nextVisitPreparedAt: string | null;
}

export interface ExtractedField {
  value: string;
  status: 'extracted' | 'needs_review' | 'not_found';
}

export interface ExtractedFields {
  recordType: ExtractedField;
  visitType: ExtractedField;
  date: ExtractedField;
  facility: ExtractedField;
  responsibleDoctor: ExtractedField;
  gestationalAge: ExtractedField;
  patientName: ExtractedField;
  mrn: ExtractedField;
}

interface RecordDto {
  id: string;
  patientId: string;
  title: string;
  category: RecordCategory;
  timestamp: string;
  gestationalAgeWeeks: number;
  gestationalAgeDays: number;
  trimester: 1 | 2 | 3;
  author: string;
  authorRole: string;
  facility: string;
  modality: string;
  sourceType: string;
  summaryText: string;
  fullContent: string;
  sourceId: string;
  tags: string[];
  isAiStructuredOnly: boolean;
  documentFilename: string | null;
  rawPayloadSnippet: string | null;
  verificationStatus: VerificationStatus;
  verifiedBy: string | null;
  verifiedAt: string | null;
  extractionStatus: Record<string, ExtractedField>;
  vitalBp: string | null;
  vitalWeightLbs: number | null;
  vitalFhrBpm: number | null;
  vitalFundalHeightCm: number | null;
}

interface WorkflowItemDto {
  id: string;
  patientId: string;
  recordId: string | null;
  type: WorkflowItemType;
  title: string;
  description: string;
  dueDate: string | null;
  priority: WorkflowPriority;
  status: WorkflowStatus;
  assignee: string | null;
  assignedRole: string | null;
  sourceContext: string;
  dateCreated: string;
  lastUpdatedAt: string;
  verificationStatus: string | null;
}

interface ActivityLogDto {
  id: string;
  patientId: string;
  recordId: string | null;
  action: ActivityLogAction;
  title: string;
  details: string;
  user: string;
  role: string;
  timestamp: string;
}

function mapRecord(r: RecordDto): PatientRecord {
  const hasVitals = r.vitalBp || r.vitalWeightLbs || r.vitalFhrBpm || r.vitalFundalHeightCm;
  return {
    id: r.id,
    patientId: r.patientId,
    title: r.title,
    category: r.category,
    timestamp: r.timestamp,
    gestationalAgeWeeks: r.gestationalAgeWeeks,
    gestationalAgeDays: r.gestationalAgeDays,
    trimester: r.trimester,
    author: r.author,
    authorRole: r.authorRole,
    facility: r.facility,
    modality: r.modality,
    sourceType: r.sourceType,
    summaryText: r.summaryText,
    fullContent: r.fullContent,
    sourceId: r.sourceId,
    tags: r.tags,
    isAiStructuredOnly: r.isAiStructuredOnly,
    attachmentName: r.documentFilename || undefined,
    verificationStatus: r.verificationStatus,
    verifiedBy: r.verifiedBy || undefined,
    verifiedAt: r.verifiedAt || undefined,
    rawPayloadSnippet: r.rawPayloadSnippet || undefined,
    vitalSnapshot: hasVitals ? {
      bp: r.vitalBp || undefined,
      weightLbs: r.vitalWeightLbs || undefined,
      fetalHeartRateBpm: r.vitalFhrBpm || undefined,
      fundalHeightCm: r.vitalFundalHeightCm || undefined,
    } : undefined,
  };
}

function mapWorkflowItem(w: WorkflowItemDto): PendingWorkflowItem {
  return {
    id: w.id,
    recordId: w.recordId || undefined,
    type: w.type,
    title: w.title,
    description: w.description,
    dueDate: w.dueDate || undefined,
    priority: w.priority,
    status: w.status,
    assignee: w.assignee || undefined,
    assignedRole: w.assignedRole || undefined,
    sourceContext: w.sourceContext,
    dateCreated: w.dateCreated,
    lastUpdatedAt: w.lastUpdatedAt,
    verificationStatus: (w.verificationStatus as PendingWorkflowItem['verificationStatus']) || undefined,
  };
}

function mapActivity(a: ActivityLogDto): ActivityLogEntry {
  return {
    id: a.id,
    episodeId: a.patientId,
    action: a.action,
    title: a.title,
    details: a.details,
    user: a.user,
    role: a.role,
    timestamp: a.timestamp,
    recordId: a.recordId || undefined,
  };
}

export function fetchPatientList(): Promise<PatientSummary[]> {
  return api.get<PatientSummary[]>('/api/patients');
}

export async function fetchFullEpisode(patientId: string): Promise<PatientEpisode> {
  const [patient, records, workflowItems, activityLogs, adminDocs] = await Promise.all([
    api.get<PatientDto>(`/api/patients/${patientId}`),
    api.get<RecordDto[]>(`/api/patients/${patientId}/records`),
    api.get<WorkflowItemDto[]>(`/api/patients/${patientId}/workflow-items`),
    api.get<ActivityLogDto[]>(`/api/patients/${patientId}/activity`),
    api.get<AdministrativeDocCheck[]>(`/api/patients/${patientId}/admin-docs`),
  ]);

  return {
    id: patient.id,
    patientName: patient.patientName,
    mrn: patient.mrn || '',
    age: patient.age ?? 0,
    dob: patient.dob || '',
    gestationalAgeWeeks: patient.gestationalAgeWeeks,
    gestationalAgeDays: patient.gestationalAgeDays,
    edd: patient.edd,
    gravidaPara: patient.gravidaPara,
    bloodType: patient.bloodType,
    allergies: patient.allergies,
    primaryClinician: patient.primaryClinician,
    episodeStartDate: patient.episodeStartDate,
    riskCategory: patient.riskCategory,
    riskNotes: patient.riskNotes,
    facility: patient.facility,
    isReadyForTodayBrief: patient.isReadyForTodayBrief,
    handoffTimestamp: patient.handoffTimestamp || undefined,
    handoffNotes: patient.handoffNotes || undefined,
    nextVisitPreparedAt: patient.nextVisitPreparedAt || undefined,
    records: records.map(mapRecord),
    workflowItems: workflowItems.map(mapWorkflowItem),
    activityLogs: activityLogs.map(mapActivity),
    administrativeDocs: adminDocs,
  };
}

export function createPatient(payload: { patientName: string; age?: number; dob?: string; edd: string; mrn?: string }): Promise<{ id: string }> {
  return api.post<PatientDto>('/api/patients', payload);
}

export function markReadyForTodaysBrief(patientId: string): Promise<void> {
  return api.patch<PatientDto>(`/api/patients/${patientId}`, { isReadyForTodayBrief: true }).then(() => undefined);
}

export interface UploadResult {
  record: RecordDto;
  extractedFields: ExtractedFields;
  ocrUsed: boolean;
  ocrUnavailable: boolean;
}

export async function uploadRecord(patientId: string, file: File): Promise<{ record: PatientRecord; extractedFields: ExtractedFields; ocrUsed: boolean; ocrUnavailable: boolean }> {
  const formData = new FormData();
  formData.append('file', file);
  const result = await api.upload<UploadResult>(`/api/patients/${patientId}/records/upload`, formData);
  return { ...result, record: mapRecord(result.record) };
}

export async function updateRecord(patientId: string, recordId: string, payload: Partial<{
  title: string; category: string; timestamp: string; author: string; facility: string; summaryText: string;
  verificationStatus: VerificationStatus; verifiedBy: string;
}>): Promise<PatientRecord> {
  const dto = await api.patch<RecordDto>(`/api/patients/${patientId}/records/${recordId}`, payload);
  return mapRecord(dto);
}

export async function approveRecord(patientId: string, recordId: string): Promise<PatientRecord> {
  const dto = await api.post<RecordDto>(`/api/patients/${patientId}/records/${recordId}/approve`);
  return mapRecord(dto);
}

export async function rejectRecord(patientId: string, recordId: string): Promise<PatientRecord> {
  const dto = await api.post<RecordDto>(`/api/patients/${patientId}/records/${recordId}/reject`);
  return mapRecord(dto);
}

export async function createManualRecord(patientId: string, payload: {
  category: RecordCategory;
  timestamp: string;
  facility: string;
  author: string;
  summaryText: string;
  sourceReference: string;
}): Promise<PatientRecord> {
  const dto = await api.post<RecordDto>(`/api/patients/${patientId}/records/manual`, payload);
  return mapRecord(dto);
}

export function recordSourceUrl(patientId: string, recordId: string): string {
  return `/api/patients/${patientId}/records/${recordId}/source`;
}

export async function createWorkflowItem(patientId: string, payload: {
  type: WorkflowItemType; title: string; description?: string; dueDate?: string; priority?: WorkflowPriority; assignee?: string; sourceContext?: string;
}): Promise<PendingWorkflowItem> {
  const dto = await api.post<WorkflowItemDto>(`/api/patients/${patientId}/workflow-items`, payload);
  return mapWorkflowItem(dto);
}

export async function updateWorkflowItem(patientId: string, itemId: string, payload: Partial<{
  status: WorkflowStatus; assignee: string; dueDate: string; description: string;
}>): Promise<PendingWorkflowItem> {
  const dto = await api.patch<WorkflowItemDto>(`/api/patients/${patientId}/workflow-items/${itemId}`, payload);
  return mapWorkflowItem(dto);
}
