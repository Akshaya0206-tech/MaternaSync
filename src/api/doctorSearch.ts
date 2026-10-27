import { api } from './client';

// The doctor's one search box (backend/app/routers/doctor_search.py). The words typed go in the body of a POST, not in the address, so they are
// not left in any request log (they may be a patient's name).
export interface SearchGroup<T> {
  /** How many matched in all; `items` holds the first few. */
  total: number;
  items: T[];
}

export interface SearchPatient {
  id: string;
  label: string;
  patientName: string;
  date: null;
  matchedOn: 'name' | 'mrn' | 'phone';
  /** The record number or phone that matched, when that is what matched. */
  detail: string | null;
  link: string;
}

export interface SearchQuestion {
  id: string;
  /** At most 120 characters of the question. */
  label: string;
  patientName: string;
  date: string | null;
  state: 'needs_reply' | 'answered' | 'handled' | 'closed';
  matchedOn: 'text' | 'patient' | 'earlier';
  link: string;
}

export interface SearchDocument {
  id: string;
  label: string;
  patientName: string;
  date: string | null;
  description: string | null;
  documentType: string | null;
  documentDate: string | null;
  filename: string;
  matchedOn: 'title' | 'filename' | 'kind' | 'patient';
  /** The file name, when that is what matched and the label is something else. */
  detail: string | null;
  link: string;
}

export interface DoctorSearchResult {
  patients: SearchGroup<SearchPatient>;
  questions: SearchGroup<SearchQuestion>;
  documents: SearchGroup<SearchDocument>;
}

export const searchDoctor = (q: string, limit = 5) => api.post<DoctorSearchResult>('/api/v2/doctor/search', { q, limit });
