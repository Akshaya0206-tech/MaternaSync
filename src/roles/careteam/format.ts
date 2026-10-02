import type { BadgeTone } from '../../components/StatusBadge';

export function formatFriendlyDate(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatFriendlyDateTime(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function timeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export const DOCUMENT_STATUS_TONE: Record<string, BadgeTone> = {
  PROCESSING: 'neutral',
  NEEDS_REVIEW: 'amber',
  VERIFIED: 'green',
  REJECTED: 'red',
};

const QUESTION_STATUS_LABELS: Record<string, string> = {
  NEW: 'New',
  ASSIGNED: 'Assigned',
  WAITING_FOR_RESPONSE: 'Waiting for Response',
  ANSWERED: 'Answered',
  CLOSED: 'Closed',
};
export function friendlyQuestionStatus(status: string): string {
  return QUESTION_STATUS_LABELS[status] ?? status;
}
export const QUESTION_STATUS_TONE: Record<string, BadgeTone> = {
  NEW: 'blue',
  ASSIGNED: 'purple',
  WAITING_FOR_RESPONSE: 'amber',
  ANSWERED: 'green',
  CLOSED: 'neutral',
};

const TASK_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  WAITING: 'Waiting',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};
export function friendlyTaskStatus(status: string): string {
  return TASK_STATUS_LABELS[status] ?? status;
}
export const TASK_STATUS_TONE: Record<string, BadgeTone> = {
  OPEN: 'blue',
  IN_PROGRESS: 'purple',
  WAITING: 'amber',
  COMPLETED: 'green',
  CANCELLED: 'neutral',
};

const REFERRAL_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  ACKNOWLEDGED: 'Acknowledged',
  APPOINTMENT_SCHEDULED: 'Appointment Scheduled',
  RESPONSE_RECEIVED: 'Response Received',
  CLOSED: 'Closed',
};
export function friendlyReferralStatus(status: string): string {
  return REFERRAL_STATUS_LABELS[status] ?? status;
}
export const REFERRAL_STATUS_TONE: Record<string, BadgeTone> = {
  DRAFT: 'neutral',
  SENT: 'blue',
  ACKNOWLEDGED: 'purple',
  APPOINTMENT_SCHEDULED: 'amber',
  RESPONSE_RECEIVED: 'green',
  CLOSED: 'neutral',
};
