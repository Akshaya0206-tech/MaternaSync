export type RecordCategory = 
  | 'consultation_note'
  | 'referral'
  | 'patient_message'
  | 'care_document'
  | 'follow_up'
  | 'workflow_event';

export type WorkflowItemType = 
  | 'pending_referral'
  | 'required_document'
  | 'follow_up_needed'
  | 'unanswered_question';

export type WorkflowPriority = 'urgent' | 'important' | 'routine';
export type WorkflowStatus = 'pending' | 'in_progress' | 'verified' | 'completed';

export type VerificationStatus = 'raw' | 'verified' | 'ready_for_context';

export interface PendingWorkflowItem {
  id: string;
  recordId?: string;
  type: WorkflowItemType;
  title: string;
  description: string;
  dueDate?: string;
  priority: WorkflowPriority;
  status: WorkflowStatus;
  assignee?: string;
  assignedRole?: string;
  sourceContext: string;
  dateCreated: string;
  verificationStatus?: 'Pending Care-Team Review' | 'Verified by Clinician' | 'Patient Self-Report';
}

export interface PatientRecord {
  id: string;
  patientId: string;
  title: string;
  category: RecordCategory;
  timestamp: string; // ISO format or YYYY-MM-DD HH:mm
  gestationalAgeWeeks: number;
  gestationalAgeDays: number;
  trimester: 1 | 2 | 3;
  author: string;
  authorRole: string;
  facility: string;
  modality: string;
  sourceType?: string;
  summaryText: string;
  fullContent: string;
  sourceId: string;
  tags: string[];
  isAiStructuredOnly: boolean; // Always false for raw approved patient records
  workflowItemIds?: string[];
  documentUrl?: string;
  attachmentName?: string;
  verificationStatus?: VerificationStatus;
  verifiedBy?: string;
  verifiedAt?: string;
  rawPayloadSnippet?: string;
  vitalSnapshot?: {
    bp?: string;
    weightLbs?: number;
    fetalHeartRateBpm?: number;
    fundalHeightCm?: number;
  };
}

export interface AdministrativeDocCheck {
  id: string;
  title: string;
  category: 'intake' | 'consent' | 'identification' | 'preferences' | 'postpartum_plan';
  status: 'complete' | 'missing' | 'pending_verification';
  requiredByStage: string;
  lastUpdated?: string;
  notes?: string;
}

export type ActivityLogAction = 
  | 'record_added'
  | 'record_replaced'
  | 'record_verified'
  | 'workflow_created'
  | 'workflow_updated'
  | 'phase1_handoff'
  | 'duplicate_reviewed';

export interface ActivityLogEntry {
  id: string;
  episodeId: string;
  action: ActivityLogAction;
  title: string;
  details: string;
  user: string;
  role: string;
  timestamp: string;
  recordId?: string;
}

export interface PatientEpisode {
  id: string;
  patientName: string;
  mrn: string;
  age: number;
  dob: string;
  gestationalAgeWeeks: number;
  gestationalAgeDays: number;
  edd: string; // Estimated Due Date
  gravidaPara: string; // e.g., "G2 P1001"
  bloodType: string;
  allergies: string[];
  primaryClinician: string;
  episodeStartDate: string;
  riskCategory: 'routine' | 'moderate' | 'high_risk';
  riskNotes: string;
  facility: string;
  records: PatientRecord[];
  workflowItems: PendingWorkflowItem[];
  administrativeDocs?: AdministrativeDocCheck[];
  activityLogs?: ActivityLogEntry[];
  isReadyForTodayBrief: boolean;
  handoffTimestamp?: string;
  handoffNotes?: string;
}

export interface HandoffPayload {
  episodeId: string;
  patientName: string;
  mrn: string;
  gestationalAge: string;
  recordsCount: number;
  pendingWorkflowCount: number;
  recordsByCategory: Record<RecordCategory, number>;
  workflowItemsByType: Record<WorkflowItemType, number>;
  verificationBreakdown: Record<VerificationStatus, number>;
  chronologicalTimeline: {
    id: string;
    timestamp: string;
    category: RecordCategory;
    title: string;
    author: string;
    verificationStatus: VerificationStatus;
  }[];
  pendingItems: PendingWorkflowItem[];
  administrativeCompleteness: {
    totalDocs: number;
    complete: number;
    missing: number;
    pendingVerification: number;
  };
  qualityChecklist: {
    episodeSelected: boolean;
    recordsCollected: boolean;
    timelineGenerated: boolean;
    sourcePreserved: boolean;
    workflowCatalogued: boolean;
    recordsVerifiedWhereRequired: boolean;
    safetyBoundaryMaintained: boolean;
  };
  generatedAt: string;
  careTeamSignOffBy: string;
}

export type PhaseStage = 'phase1' | 'phase2' | 'consultation';

export interface DraftSectionState {
  isApproved: boolean;
  approvedBy?: string;
  approvedAt?: string;
  isEditing: boolean;
  content: string;
}


