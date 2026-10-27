import { patientReferences } from './patientReferences';
import { topicFingerprint } from './topicFingerprint';

let cached: Record<string, string> | null = null;

/** The fingerprint of every topic that ships with the app, by topic id (made once). Both the doctor's Patient information tab and the patient's
 *  References page use this, so they always compare the same thing. */
export function topicFingerprints(): Record<string, string> {
  if (!cached) cached = Object.fromEntries(patientReferences.topics.map((topic) => [topic.id, topicFingerprint(topic)]));
  return cached;
}
