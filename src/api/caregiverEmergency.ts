import { api } from './client';
import type { ClinicHospital } from './emergency';

const BASE = '/api/v2/caregiver';

/** What a hospital needs from the card a trusted person shows: five things, and nothing about her health. A missing one is null. */
export interface HospitalCardData {
  name: string | null;
  dueDate: string | null;
  doctorName: string | null;
  clinicPhone: string | null;
  mcpNumber: string | null;
}

export const caregiverHospitalCard = (link: string) => api.get<HospitalCardData>(`${BASE}/${link}/hospital-card`);
/** The hospitals her doctor's clinic recommends: the same list she sees on her own Emergency help page. */
export const caregiverClinicHospitals = (link: string) => api.get<{ hospitals: ClinicHospital[] }>(`${BASE}/${link}/clinic-hospitals`).then((answer) => answer.hospitals);
/** Tells the server the card was opened (for her record of what her helper did). `at` is when it was opened, if it could not be sent then. */
export const reportHospitalCardOpened = (link: string, at?: string) => api.post<{ recorded: boolean }>(`${BASE}/${link}/hospital-card/opened`, at ? { at } : {});
