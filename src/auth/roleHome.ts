const ROLE_HOME: Record<string, string> = {
  patient: '/patient/dashboard',
  doctor: '/doctor/dashboard',
  caregiver: '/caregiver/home',
  // Still routed, so switching the care-team login back on (MATERNASYNC_CARE_TEAM_ENABLED=true) needs no change here.
  care_team: '/care-team/dashboard',
};

/** Where to send an authenticated user by default. Falls back to the
 * untouched legacy single-clinician app for any pre-migration role
 * (nurse / care_coordinator / other) that has no new-system workspace. */
export function homePathForRole(role: string): string {
  return ROLE_HOME[role] ?? '/legacy';
}
