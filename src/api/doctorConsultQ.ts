import { api } from './client';
import type { CareTeamQuestion } from './careTeamPortal';

/** An approved note layout the doctor can choose before she starts a note (the clinic's templates, as in Document studio). */
export interface NoteLayout {
  id: string;
  title: string;
  version: number;
  fields: string[];
  default: boolean;
}

/** The note the doctor approved most recently for a patient, as written. `key` names a standard section; a clinic layout's own sections carry a `heading`. */
export interface LastApprovedVisit {
  consultationId: string;
  approvedAt: string;
  approvedByName: string;
  layoutTitle: string | null;
  sections: { key: string; heading: string | null; text: string }[];
}

/** A reply the doctor wrote herself and saved to use again. It belongs to her alone. */
export interface ReplySnippet {
  id: string;
  title: string;
  text: string;
  updatedAt: string;
}

export const fetchNoteLayouts = () => api.get<NoteLayout[]>('/api/v2/doctor/note-layouts');
export const fetchLastApprovedVisit = (episodeId: string) => api.get<LastApprovedVisit | null>(`/api/v2/doctor/episodes/${episodeId}/last-approved-visit`);

export const fetchReplySnippets = () => api.get<ReplySnippet[]>('/api/v2/doctor/reply-snippets');
export const addReplySnippet = (title: string, text: string) => api.post<ReplySnippet>('/api/v2/doctor/reply-snippets', { title, text });
export const changeReplySnippet = (id: string, title: string, text: string) => api.patch<ReplySnippet>(`/api/v2/doctor/reply-snippets/${id}`, { title, text });
export const deleteReplySnippet = (id: string) => api.delete<{ deleted: string }>(`/api/v2/doctor/reply-snippets/${id}`);

/** Closes a question the doctor dealt with by phone or in the clinic. The note is for doctors only. */
export const closeQuestionHandled = (questionId: string, note: string) => api.post<CareTeamQuestion>(`/api/v2/doctor/questions/${questionId}/close-handled`, { note });
