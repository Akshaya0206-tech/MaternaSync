import { currentLocale, translate, tx } from '../../i18n';

export function formatFriendlyDate(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(currentLocale(), { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatFriendlyTime(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(currentLocale(), { hour: 'numeric', minute: '2-digit' });
}

export function timeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return translate('Good morning');
  if (hour < 18) return translate('Good afternoon');
  return translate('Good evening');
}

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

const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  requested: tx('Awaiting confirmation'),
  no_show: tx('Missed appointment'),
  scheduled: tx('Scheduled'),
  completed: tx('Completed'),
  cancelled: tx('Cancelled'),
};

export function friendlyAppointmentStatus(status: string): string {
  return translate(APPOINTMENT_STATUS_LABELS[status] ?? status);
}

const DOCUMENT_STATUS_LABELS: Record<string, string> = {
  PROCESSING: tx('Processing'),
  NEEDS_REVIEW: tx('Under Review'),
  VERIFIED: tx('Verified'),
  REJECTED: tx('Rejected'),
};

export function friendlyDocumentStatus(status: string, serverLabel: string): string {
  return translate(DOCUMENT_STATUS_LABELS[status] ?? serverLabel);
}
