import { api } from './client';
import type { PatientAppointment } from './patientPortal';

/** The patient's My Questions and Appointments extras: files on a question, the clinic's usual reply time, and asking to cancel or move a visit. */

export const MOST_ATTACHMENTS = 3;
export const MOST_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export function attachToQuestion(questionId: string, file: File): Promise<{ id: string; filename: string }> {
  const form = new FormData();
  form.append('file', file);
  return api.upload<{ id: string; filename: string }>(`/api/v2/patient/questions/${questionId}/attachments`, form);
}

/** What the clinic's doctor wrote as the usual reply time. Empty when none is set. */
export function fetchQuestionInfo(): Promise<{ replyTime: string }> {
  return api.get<{ replyTime: string }>('/api/v2/patient/questions-info');
}

export function askToChangeVisit(appointmentId: string, body: { kind: 'cancel' | 'reschedule'; preferredAt?: string; note?: string }): Promise<PatientAppointment> {
  return api.post<PatientAppointment>(`/api/v2/patient/appointments/${appointmentId}/change-request`, body);
}

export function withdrawVisitChange(appointmentId: string): Promise<PatientAppointment> {
  return api.delete<PatientAppointment>(`/api/v2/patient/appointments/${appointmentId}/change-request`);
}
