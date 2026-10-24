import { api } from './client';

export type UserRole = 'patient' | 'doctor' | 'care_team' | 'nurse' | 'care_coordinator' | 'other';

export interface CurrentUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
}

interface TokenResponse {
  accessToken: string;
  tokenType: string;
  user: CurrentUser;
}

export function login(email: string, password: string): Promise<TokenResponse> {
  return api.post<TokenResponse>('/api/auth/login', { email, password });
}

/** A new patient's home and emergency details, saved together with the account. */
export interface SignUpEmergency {
  homeLabel: string | null;
  homeLat: number | null;
  homeLon: number | null;
  contactName: string | null;
  contactRelation: string | null;
  contactPhone: string | null;
  hospitalName: string | null;
  hospitalPhone: string | null;
}

interface RegisterResponse extends TokenResponse {
  /** For a patient: false when the area typed could not be found on the map. */
  locationFound: boolean | null;
}

export function register(payload: {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: UserRole;
  emergency?: SignUpEmergency;
}): Promise<RegisterResponse> {
  return api.post<RegisterResponse>('/api/auth/register', payload);
}

export function fetchCurrentUser(): Promise<CurrentUser> {
  return api.get<CurrentUser>('/api/auth/me');
}

export interface DemoAccount { label: string; role: UserRole; name: string; email: string; password: string }
export const fetchDemoAccounts = () => api.get<DemoAccount[]>('/api/auth/demo-accounts');
