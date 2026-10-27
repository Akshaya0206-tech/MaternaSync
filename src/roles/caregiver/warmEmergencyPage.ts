let warmed = false;

/** Downloads the caregiver pages (the chunk the Emergency help route is served from) in the background soon after a trusted person's list of women has loaded, so the service worker keeps it and the page
 *  opens with no signal even if they first landed on another page (the patient's shell does the same for hers). Does nothing while developing. */
export function warmEmergencyPage() {
  if (warmed || !import.meta.env.PROD) return;
  warmed = true;
  window.setTimeout(() => { void import('./CaregiverPages').catch(() => { warmed = false; }); }, 2000);
}
