import { api } from "./client";
import { currentLocale, translate } from "../i18n";

export const ROOT = "/api/v2/continuity";
export const languages = {
  en: "English",
  hi: "हिन्दी · Hindi",
  ta: "தமிழ் · Tamil",
  te: "తెలుగు · Telugu",
};
export type Language = keyof typeof languages;
export interface EpisodeChoice {
  id: string;
  patientName: string;
  weeks: number;
  members: { id: string; name: string }[];
}
export interface Context {
  language: Language;
  episodes: EpisodeChoice[];
}
export interface DailyLog {
  id: string;
  recordedAt: string;
  systolic: number | null;
  diastolic: number | null;
  weightKg: number | null;
  symptoms: string;
  mood: string;
  adherence: string;
  movementCount: number | null;
  movementMinutes: number | null;
  skipped: boolean;
  revision: number;
  correctionReason: string;
  /** Who sat with the patient and helped fill this in, if anyone (for example "ASHA worker: Rekha"). */
  enteredWithHelp: string | null;
}
export interface Consent {
  id: string;
  recipient: string;
  purpose: string;
  expiresAt: string;
  grantedAt: string;
  revokedAt: string | null;
  active: boolean;
}
export interface Reminder {
  id: string;
  kind: string;
  title: string;
  instructions: string;
  scheduledAt: string;
  status: string;
  approvedByName: string;
  sourceId: string;
}
export interface Appointment {
  id: string;
  scheduledAt: string;
  appointmentType: string;
  status: string;
  notes: string;
}
export interface Source {
  id: string;
  type: "document" | "consultation" | "question";
  title: string;
}
export interface Resource {
  id: string;
  familyId: string;
  version: number;
  kind: string;
  title: string;
  topic: string;
  issuer: string;
  jurisdiction: string;
  publicationDate: string | null;
  sourceUrl: string;
  section: string;
  content: string;
  language: Language;
  stage: string;
  status: string;
  rightsNote: string;
  reviewDue: string | null;
  lastCheckedAt: string | null;
  approvedByName: string | null;
  usable: boolean;
  hasFile: boolean;
  configuration: {
    fields?: string[];
    required?: string[];
    default?: boolean;
    steps?: { title: string; days: number }[];
    [key: string]: unknown;
  };
}
export interface ParsedResult {
  name: string;
  testId: string | null;
  valueText: string;
  unit: string | null;
  rangeText: string;
  originalLine: string;
}
export interface ReviewNote {
  level: "blocker" | "warning" | "info";
  text: string;
}
export interface CompanionReply {
  language: Language;
  intent: string;
  message: string;
  safety: "urgent" | "clinical" | null;
  actions: (
    | { type: "send_to_care_team" }
    | { type: "navigate"; route: string; label: string }
  )[];
  education: Resource[];
}
export interface ClinicalOutput {
  id: string;
  kind: string;
  title: string;
  content: string;
  language: Language;
  sourceType: string;
  sourceId: string;
  sourceSnapshot?: {
    title: string;
    text: string;
    date?: string;
    reviewer?: string;
    draftNotes?: string[];
    parsedResults?: ParsedResult[];
  };
  reviewNotes?: ReviewNote[];
  /** Heading → section kind (happened, next, general, results…) for sectioned plain-language outputs. */
  sectionKinds?: Record<string, string>;
  appointmentId: string | null;
  structuredData?: Record<string, string>;
  selectedCodes?: string[];
  status: string;
  revision: number;
  visibleToPatient: boolean;
  approvedByName: string | null;
  approvedAt: string | null;
}
export interface Flag {
  id: string;
  ruleId: string;
  ruleTitle: string;
  version: number;
  metric: string;
  value: number;
  operator: string;
  threshold: number;
  nextAction: string;
  sourceId: string | null;
  recordedAt: string;
  sourceUrl: string;
  reviewer: string;
  context: string;
  confirmed: {
    by: string;
    at: string;
    decision: "create_task" | "no_action_needed" | null;
    note: string;
    taskId: string | null;
  } | null;
}
export interface Trends {
  logs: DailyLog[];
  flags: Flag[];
  daysWithLogs: number;
  missingDays: number;
  activeRuleCount: number;
  openFlagCount: number;
}
export interface Outreach {
  id: string;
  recipient: string;
  message: string;
  status: string;
  provider: string | null;
  providerReference: string | null;
  createdAt: string;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  failedReason: string | null;
}
export interface Task {
  id: string;
  title: string;
  dueDate: string | null;
  status: string;
  ownerName: string;
  ownerUserId: string | null;
  history: { name: string; by: string; at: string }[];
}
export interface Workspace {
  episodeId: string;
  patientName: string;
  language: Language;
  logs: DailyLog[];
  reminders: Reminder[];
  consents: Consent[];
  outputs: ClinicalOutput[];
  appointments: Appointment[];
  sources?: Source[];
  trends?: Trends;
  whatsapp?: { mode: "cloud_api" | "simulator" | "manual"; automatic: boolean };
  monitoring: {
    intervalDays: number;
    active: boolean;
    ownerUserId: string;
  } | null;
  enrollments?: {
    id: string;
    title: string;
    resourceId: string;
    createdAt: string;
  }[];
  outreach?: Outreach[];
  outcomes?: {
    id: string;
    kind: string;
    value: string;
    eventDate: string;
    sourceDocumentId: string;
  }[];
  handovers?: { id: string; title: string }[];
}
export interface Clinic {
  patients: {
    episodeId: string;
    patientName: string;
    doctors: string[];
    openTasks: number;
    unassigned: number;
    overdue: number;
    upcomingVisits: number;
    appointmentRequests: number;
    lastCheckIn: string | null;
    checkInDue: string | null;
    missingCheckIn: boolean;
    openFlagCount: number;
    monitoringOwner: string | null;
  }[];
  metrics: {
    recordedScans: number;
    onTimeScans: number;
    recordedDeliveries: number;
    deliveryOutcomes: Record<string, number>;
    attendedOrNoShow: number;
    noShows: number;
  };
  definition: string;
}
export const getContext = () => api.get<Context>(`${ROOT}/context`);
export const getWorkspace = (id: string) =>
  api.get<Workspace>(`${ROOT}/episodes/${id}`);
export const getLibrary = (query = "") =>
  api.get<Resource[]>(`/api/v2/library${query ? `?${query}` : ""}`);
export const formatTime = (value: string | null) =>
  value
    ? new Date(value).toLocaleString(currentLocale(), {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : translate("Not recorded");
export function localDateTime(value = new Date()) {
  return new Date(value.getTime() - value.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
