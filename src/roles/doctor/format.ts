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

// "Assigned" and "Waiting for Response" are the system's own words. To the doctor they all mean one thing: it is waiting for her reply.
const QUESTION_STATUS_LABELS: Record<string, string> = {
  NEW: tx('Needs your reply'),
  ASSIGNED: tx('Needs your reply'),
  WAITING_FOR_RESPONSE: tx('Needs your reply'),
  ANSWERED: tx('Answered'),
  CLOSED: tx('Closed'),
};
const HANDLED_LABEL = tx('Handled by phone or in clinic');
export function friendlyQuestionStatus(status: string, closedHow?: string | null): string {
  if (status === 'CLOSED' && closedHow === 'phone_or_clinic') return translate(HANDLED_LABEL);
  return translate(QUESTION_STATUS_LABELS[status] ?? status);
}
export const QUESTION_STATUS_TONE: Record<string, BadgeTone> = {
  NEW: 'amber',
  ASSIGNED: 'amber',
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

// Plain time words for the dashboard and the patient list (only how long ago, never how urgent).
type Say = (text: string, values?: Record<string, string | number>) => string;

/** How long ago something happened, in plain words and whole days (on the doctor's own calendar). */
export function daysSince(iso: string | null | undefined, now = new Date()): number | null {
  if (!iso) return null;
  const moment = new Date(iso);
  if (Number.isNaN(moment.getTime())) return null;
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((startOf(now) - startOf(moment)) / 86_400_000);
}

/** "Waiting less than an hour", "Waiting 5 hours", "Waiting 3 days": only how long, never how urgent. */
export function waitingWords(t: Say, since: string, now = new Date()): string {
  const hours = Math.max(0, Math.floor((now.getTime() - new Date(since).getTime()) / 3_600_000));
  if (hours < 1) return t('Waiting less than an hour');
  if (hours < 24) return hours === 1 ? t('Waiting 1 hour') : t('Waiting {count} hours', { count: hours });
  const days = Math.floor(hours / 24);
  return days === 1 ? t('Waiting 1 day') : t('Waiting {count} days', { count: days });
}

/** "Last check-in today / 1 day ago / 3 days ago" or "No check-in yet". A plain date, nothing about what it held. */
export function lastCheckInWords(t: Say, iso: string | null | undefined, now = new Date()): string {
  const days = daysSince(iso, now);
  if (days === null) return t('No check-in yet');
  if (days <= 0) return t('Last check-in today');
  return days === 1 ? t('Last check-in 1 day ago') : t('Last check-in {count} days ago', { count: days });
}

/** Whole days until a due date written as YYYY-MM-DD (negative once it has passed). */
export function daysToDueDate(edd: string | null | undefined, now = new Date()): number | null {
  const parts = edd?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!parts) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((new Date(+parts[1], +parts[2] - 1, +parts[3]).getTime() - today) / 86_400_000);
}

/** "Due date passed 18 days ago" once it has passed; nothing before (the date itself is shown beside it). Plain arithmetic on dates. */
export function dueDatePassedWords(t: Say, edd: string | null | undefined, now = new Date()): string | null {
  const days = daysToDueDate(edd, now);
  if (days === null || days > 0) return null;
  if (days === 0) return t('Due date is today');
  return days === -1 ? t('Due date passed 1 day ago') : t('Due date passed {count} days ago', { count: -days });
}
