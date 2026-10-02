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

export function register(payload: {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: UserRole;
}): Promise<TokenResponse> {
  return api.post<TokenResponse>('/api/auth/register', payload);
}

export function fetchCurrentUser(): Promise<CurrentUser> {
  return api.get<CurrentUser>('/api/auth/me');
}
