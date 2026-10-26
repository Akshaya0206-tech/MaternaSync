import { ApiError, api, apiUrl, getToken } from './client';
import type { CurrentUser } from './auth';

// A signed-in person's own account (backend/app/routers/account.py). Changing the password and "Sign out other devices" end every other session,
// so both hand back a fresh sign-in token for THIS device: store it straight away (AuthContext.login does).
export interface FreshSession {
  accessToken: string;
  user: CurrentUser;
}

export const changePassword = (currentPassword: string, newPassword: string, confirmPassword: string) =>
  api.post<FreshSession>('/api/auth/change-password', { currentPassword, newPassword, confirmPassword });

export const signOutOtherDevices = () => api.post<FreshSession>('/api/auth/sign-out-other-devices');

export interface ClosedAccount {
  closed: boolean;
  trustedPeopleRemoved: number;
  sharingPermissionsEnded: number;
  tasksForDoctor: number;
}

export const closeMyAccount = (password: string) => api.post<ClosedAccount>('/api/v2/patient/close-account', { password, understood: true });

/** Asks for the zip of her own data and saves it through the browser's normal download. */
export async function downloadMyData(): Promise<void> {
  const token = getToken();
  const response = await fetch(apiUrl('/api/v2/patient/my-data'), { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!response.ok) throw new ApiError('Could not prepare the file.', response.status);
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = 'maternasync-my-data.zip';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
