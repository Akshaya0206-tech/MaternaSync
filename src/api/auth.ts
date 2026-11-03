import { api } from './client';

export type UserRole = 'patient' | 'doctor' | 'caregiver' | 'care_team' | 'nurse' | 'care_coordinator' | 'other';

export interface CurrentUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
}

export interface TokenResponse {
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
  /** A trusted person can only join with the code the woman made for them. */
  inviteCode?: string;
}): Promise<RegisterResponse> {
  return api.post<RegisterResponse>('/api/auth/register', payload);
}

/** What the sign-up page offers. The care-team roles are missing while that login is switched off. */
export interface AuthOptions { careTeamEnabled: boolean; phoneOtpEnabled?: boolean; signUpRoles: { value: UserRole; label: string }[] }
export const fetchAuthOptions = () => api.get<AuthOptions>('/api/auth/options');

export function fetchCurrentUser(): Promise<CurrentUser> {
  return api.get<CurrentUser>('/api/auth/me');
}

export interface DemoAccount { label: string; role: UserRole; name: string; email: string; password: string }
export const fetchDemoAccounts = () => api.get<DemoAccount[]>('/api/auth/demo-accounts');

export interface PhoneChallenge { challengeId: string; maskedPhone: string; expiresAt: string; resendAfter: number }
export interface LoginPhone { enabled: boolean; maskedPhone: string | null }
export const fetchLoginPhone = () => api.get<LoginPhone>('/api/auth/phone');
export const startPhoneSignIn = (phone: string) => api.post<PhoneChallenge>('/api/auth/otp/start', { phone });
export const verifyPhoneSignIn = (challengeId: string, code: string) => api.post<TokenResponse>('/api/auth/otp/verify', { challengeId, code });
export const startPhoneEnrollment = (phone: string, password: string) => api.post<PhoneChallenge>('/api/auth/phone/enroll/start', { phone, password });
export const verifyPhoneEnrollment = (challengeId: string, code: string) => api.post<{ linked: boolean }>('/api/auth/phone/enroll/verify', { challengeId, code });
export const resendPhoneCode = (challengeId: string, enrolling: boolean) => api.post<PhoneChallenge>(enrolling ? '/api/auth/phone/enroll/resend' : '/api/auth/otp/resend', { challengeId });
export const removeLoginPhone = (password: string) => api.post('/api/auth/phone/remove', { password });
