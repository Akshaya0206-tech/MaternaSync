import type { BadgeTone } from '../../components/StatusBadge';
import { currentLanguage, currentLocale, translate, tx } from '../../i18n';

// English keeps the browser's own date style (so it reads exactly as before); the other languages use their regional style.
const dateLocale = () => (currentLanguage() === 'en' ? undefined : currentLocale());

export function formatFriendlyDate(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatFriendlyDateTime(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function formatFriendlyTime(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(dateLocale(), { hour: 'numeric', minute: '2-digit' });
}

export function timeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return translate('Good morning');
  if (hour < 18) return translate('Good afternoon');
  return translate('Good evening');
}

export const DOCUMENT_STATUS_TONE: Record<string, BadgeTone> = {
  PROCESSING: 'neutral',
  NEEDS_REVIEW: 'amber',
  VERIFIED: 'green',
  REJECTED: 'red',
};

const QUESTION_STATUS_LABELS: Record<string, string> = {
  NEW: tx('New'),
  ASSIGNED: tx('Assigned'),
  WAITING_FOR_RESPONSE: tx('Waiting for Response'),
  ANSWERED: tx('Answered'),
  CLOSED: tx('Closed'),
};
export function friendlyQuestionStatus(status: string): string {
  return translate(QUESTION_STATUS_LABELS[status] ?? status);
}
export const QUESTION_STATUS_TONE: Record<string, BadgeTone> = {
  NEW: 'blue',
  ASSIGNED: 'purple',
  WAITING_FOR_RESPONSE: 'amber',
  ANSWERED: 'green',
  CLOSED: 'neutral',
};

const TASK_STATUS_LABELS: Record<string, string> = {
  OPEN: tx('Open'),
  IN_PROGRESS: tx('In Progress'),
  WAITING: tx('Waiting'),
  COMPLETED: tx('Completed'),
  CANCELLED: tx('Cancelled'),
};
export function friendlyTaskStatus(status: string): string {
  return translate(TASK_STATUS_LABELS[status] ?? status);
}
export const TASK_STATUS_TONE: Record<string, BadgeTone> = {
  OPEN: 'blue',
  IN_PROGRESS: 'purple',
  WAITING: 'amber',
  COMPLETED: 'green',
  CANCELLED: 'neutral',
};

// The server sends the priority as a plain lower-case word.
const TASK_PRIORITY_LABELS: Record<string, string> = {
  routine: tx('routine'),
  high: tx('high'),
  urgent: tx('urgent'),
};
export function friendlyTaskPriority(priority: string): string {
  return translate(TASK_PRIORITY_LABELS[priority] ?? priority);
}

const DRAFT_STATUS_LABELS: Record<string, string> = {
  DRAFT: tx('AI Draft — Review Required'),
  REJECTED: tx('Rejected'),
  SUPERSEDED: tx('Superseded'),
  APPROVED: tx('Approved'),
};
export function friendlyDraftStatus(status: string): string {
  return translate(DRAFT_STATUS_LABELS[status] ?? status);
}
export const DRAFT_STATUS_TONE: Record<string, BadgeTone> = {
  DRAFT: 'purple',
  REJECTED: 'red',
  SUPERSEDED: 'neutral',
  APPROVED: 'green',
};

const HANDOVER_STATUS_LABELS: Record<string, string> = {
  DRAFT: tx('AI-Generated Draft'),
  FINAL: tx('Final · Shared Internally'),
  SUPERSEDED: tx('Superseded'),
};
export function friendlyHandoverStatus(status: string): string {
  return translate(HANDOVER_STATUS_LABELS[status] ?? status);
}
export const HANDOVER_STATUS_TONE: Record<string, BadgeTone> = {
  DRAFT: 'purple',
  FINAL: 'green',
  SUPERSEDED: 'neutral',
};
