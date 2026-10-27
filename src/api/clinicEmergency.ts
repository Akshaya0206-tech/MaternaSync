import { api } from './client';

/** A doctor's side of the patients' Emergency help page: the clinic's own contact details and the hospitals it recommends. */
export interface ClinicHospitalRow {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  note: string | null;
}

export interface ClinicEmergency {
  name: string | null;
  phone: string | null;
  hours: string | null;
  hospitals: ClinicHospitalRow[];
}

export interface HospitalInput {
  name: string;
  address: string | null;
  phone: string | null;
  note: string | null;
}

const BASE = '/api/v2/clinic/emergency';

export const getClinicEmergency = () => api.get<ClinicEmergency>(BASE);
export const saveClinicContact = (body: { clinicName: string | null; clinicPhone: string | null; clinicHours: string | null }) => api.put<ClinicEmergency>(`${BASE}/contact`, body);
export const addClinicHospital = (body: HospitalInput) => api.post<ClinicEmergency>(`${BASE}/hospitals`, body);
export const changeClinicHospital = (id: string, body: HospitalInput) => api.patch<ClinicEmergency>(`${BASE}/hospitals/${id}`, body);
export const removeClinicHospital = (id: string) => api.delete<ClinicEmergency>(`${BASE}/hospitals/${id}`);
