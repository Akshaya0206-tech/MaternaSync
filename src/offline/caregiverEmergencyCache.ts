import type { CaregiverEmergency } from '../api/caregiver';
import type { HospitalCardData } from '../api/caregiverEmergency';
import type { ClinicHospital } from '../api/emergency';

// A trusted person's Emergency help must work with no signal, like the woman's own page (src/roles/patient/emergencyCache.ts). What the server
// last sent is kept on the phone for each woman, and the Indian numbers are built into the app. Three rules keep this safe:
//  1. every key starts with `maternasync.emergency.`, the prefix that signing out already clears, so a shared phone keeps nothing;
//  2. a copy is dropped as soon as the server refuses it, or the woman is no longer on the person's list, or her emergency permission is off or has
//     ended, so a helper who stopped helping does not keep her contact on the phone;
//  3. the copy holds only what the page itself shows (her contact, preferred hospital, the card's five things and the clinic's hospitals).
const KEY = 'maternasync.emergency.cg.';
const OPENED = 'maternasync.emergency.cgopen.'; // "card opened" reports waiting to be sent: the audit record still has to reach her
const REMEMBERED = 'maternasync.caregiver.woman'; // the woman chosen last (CaregiverContext)

export interface KeptCaregiverEmergency {
  savedAt: string;
  womanName: string;
  emergency: CaregiverEmergency;
  card: HospitalCardData | null;
  hospitals: ClinicHospital[];
}

export function keepCaregiverEmergency(linkId: string, womanName: string, data: Omit<KeptCaregiverEmergency, 'savedAt' | 'womanName'>) {
  if (!linkId) return;
  try {
    localStorage.setItem(KEY + linkId, JSON.stringify({ ...data, womanName, savedAt: new Date().toISOString() } satisfies KeptCaregiverEmergency));
  } catch {
    // The phone's storage is full or blocked: the built-in numbers still show.
  }
}

function read(linkId: string): KeptCaregiverEmergency | null {
  try {
    const kept = JSON.parse(localStorage.getItem(KEY + linkId) ?? 'null') as KeptCaregiverEmergency | null;
    return kept && typeof kept.savedAt === 'string' && kept.emergency && Array.isArray(kept.emergency.numbers) ? kept : null;
  } catch {
    return null;
  }
}

export const keptCaregiverEmergency = (linkId: string | null): KeptCaregiverEmergency | null => (linkId ? read(linkId) : null);

/** The woman whose copy to show when the list of women could not be loaded (no signal): the one chosen last, otherwise the most recently saved. */
export function keptLinkToShow(): string | null {
  try {
    const ids = Object.keys(localStorage).filter((key) => key.startsWith(KEY)).map((key) => key.slice(KEY.length)).filter((id) => read(id));
    if (!ids.length) return null;
    const last = localStorage.getItem(REMEMBERED);
    if (last && ids.includes(last)) return last;
    return ids.sort((a, b) => (read(b)?.savedAt ?? '').localeCompare(read(a)?.savedAt ?? ''))[0];
  } catch {
    return null;
  }
}

export function forgetCaregiverEmergency(linkId: string) {
  try {
    localStorage.removeItem(KEY + linkId);
    localStorage.removeItem(OPENED + linkId);
  } catch {
    // Nothing to remove.
  }
}

/** Run whenever the list of women has just been loaded from the server: drops the copy of anyone who is no longer listed, whose access has ended
 *  or who has switched the emergency permission off. */
export function pruneCaregiverEmergency(women: { linkId: string; ended?: boolean; permissions?: { emergency?: boolean } }[]) {
  try {
    const allowed = new Set(women.filter((w) => !w.ended && w.permissions?.emergency).map((w) => w.linkId));
    for (const key of Object.keys(localStorage)) {
      const prefix = key.startsWith(KEY) ? KEY : key.startsWith(OPENED) ? OPENED : '';
      if (prefix && !allowed.has(key.slice(prefix.length))) localStorage.removeItem(key);
    }
  } catch {
    // Nothing to remove.
  }
}

/** Remember that the card was opened while the phone could not reach the server, to tell the server (and so her) later. At most a few are kept. */
export function queueCardOpened(linkId: string, at: string) {
  try {
    const waiting = pendingCardOpened(linkId);
    localStorage.setItem(OPENED + linkId, JSON.stringify([...waiting, at].slice(-5)));
  } catch {
    // The phone's storage is full or blocked: the opening can only be recorded if it is sent now.
  }
}

export function pendingCardOpened(linkId: string): string[] {
  try {
    const waiting = JSON.parse(localStorage.getItem(OPENED + linkId) ?? '[]') as unknown;
    return Array.isArray(waiting) ? waiting.filter((at): at is string => typeof at === 'string') : [];
  } catch {
    return [];
  }
}

export function clearPendingCardOpened(linkId: string) {
  try {
    localStorage.removeItem(OPENED + linkId);
  } catch {
    // Nothing to remove.
  }
}
