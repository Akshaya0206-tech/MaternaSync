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
export type WorkflowStatus = 'pending' | 'in_progress' | 'completed';

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
  sourceContext: string;
  dateCreated: string;
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
  summaryText: string;
  fullContent: string;
  sourceId: string;
  tags: string[];
  isAiStructuredOnly: boolean; // Always false for raw approved patient records
  workflowItemIds?: string[];
  documentUrl?: string;
  attachmentName?: string;
  vitalSnapshot?: {
    bp?: string;
    weightLbs?: number;
    fetalHeartRateBpm?: number;
    fundalHeightCm?: number;
  };
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
  chronologicalTimeline: {
    id: string;
    timestamp: string;
    category: RecordCategory;
    title: string;
    author: string;
  }[];
  pendingItems: PendingWorkflowItem[];
  generatedAt: string;
  careTeamSignOffBy: string;
}
