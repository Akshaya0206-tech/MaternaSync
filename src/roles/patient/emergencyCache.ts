import type { EmergencyNumber, EmergencyOverview } from '../../api/emergency';

// The emergency numbers must show even when the phone cannot reach the server. Two safety nets:
//  1. the last page the server sent is kept on the phone (for the signed-in person only), and
//  2. the Indian numbers are built into the app, so a first visit with no signal still shows them.
// They are the same numbers the server sends (backend/app/emergency.py INDIA_NUMBERS), so keep the two in step.
export const BUILT_IN_NUMBERS: EmergencyNumber[] = [
  { number: '112', label: 'Emergency: police, fire and ambulance', kind: 'emergency' },
  { number: '108', label: 'Emergency ambulance (in most states)', kind: 'ambulance' },
  { number: '102', label: 'Free ambulance for pregnant women and newborns (in many states)', kind: 'pregnancy' },
  { number: '181', label: 'Women helpline: support and information, not for emergencies', kind: 'support' },
];

export const BUILT_IN_OVERVIEW: EmergencyOverview = {
  profile: {
    homeLabel: null, homeLat: null, homeLon: null, hasHome: false,
    contactName: null, contactRelation: null, contactPhone: null,
    hospitalName: null, hospitalPhone: null, hospitalAddress: null, mcpNumber: null, liveLocation: false,
  },
  region: 'India',
  numbers: BUILT_IN_NUMBERS,
  note: 'These are numbers for India. If you are somewhere else, use the local emergency number.',
};

const KEY = 'maternasync.emergency.';

export function keepEmergency(userId: string, overview: EmergencyOverview) {
  if (!userId) return;
  try {
    localStorage.setItem(KEY + userId, JSON.stringify({ savedAt: new Date().toISOString(), overview }));
  } catch {
    // The phone's storage is full or blocked: the built-in numbers still show.
  }
}

export function keptEmergency(userId: string): EmergencyOverview | null {
  if (!userId) return null;
  try {
    const kept = JSON.parse(localStorage.getItem(KEY + userId) ?? 'null') as { overview?: EmergencyOverview } | null;
    return kept?.overview && Array.isArray(kept.overview.numbers) && kept.overview.profile ? kept.overview : null;
  } catch {
    return null;
  }
}

/** Removes what was kept for everyone on this phone. Called when a person signs out, so a shared phone keeps no one's contact details. */
export function forgetEmergency() {
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith(KEY)) localStorage.removeItem(key);
  } catch {
    // Nothing to remove.
  }
}
