import { tx } from '../../i18n';

// Everyday symptoms to tap instead of typing. Each tap adds one comma-separated entry to the symptoms text, so the
// patient can still add detail, and the care team reads the same plain text as before. Used by the daily check-in
// and by the guided check-in.
export const NO_SYMPTOMS = tx('No symptoms today');
export const SYMPTOMS = [
  NO_SYMPTOMS,
  tx('Headache'),
  tx('Nausea or vomiting'),
  tx('Tiredness'),
  tx('Back pain'),
  tx('Swollen feet or ankles'),
  tx('Heartburn'),
  tx('Leg cramps'),
  tx('Constipation'),
  tx('Trouble sleeping'),
  tx('Dizziness'),
];

type Translate = (text: string) => string;

export const entries = (text: string): string[] =>
  text
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

/** In another language the entry also carries the English term, so the care team can read it too. */
export const phraseFor = (label: string, language: string, t: Translate): string => (language === 'en' ? label : `${t(label)} (${label})`);

export const isPicked = (symptoms: string, label: string, language: string, t: Translate): boolean => entries(symptoms).includes(phraseFor(label, language, t));

/** The new "tapped buttons" text after a button is pressed. */
export function toggled(symptoms: string, label: string, language: string, t: Translate): string {
  const mine = phraseFor(label, language, t);
  let parts = entries(symptoms);
  if (parts.includes(mine)) parts = parts.filter((part) => part !== mine);
  else {
    // "No symptoms today" and a listed symptom cannot both be true.
    const clash = label === NO_SYMPTOMS ? SYMPTOMS.map((s) => phraseFor(s, language, t)) : [phraseFor(NO_SYMPTOMS, language, t)];
    parts = [...parts.filter((part) => !clash.includes(part)), mine];
  }
  return parts.join(', ');
}

/** Splits a saved line back into the buttons it came from and whatever was typed under "Other". */
export function splitSaved(saved: string, language: string, t: Translate): { tapped: string; typed: string } {
  const mine = SYMPTOMS.map((label) => ({ label, phrase: phraseFor(label, language, t) }));
  const parts = entries(saved);
  const tapped = parts
    .map((part) => mine.find((m) => m.phrase === part || m.label === part)?.phrase)
    .filter((part): part is string => Boolean(part));
  const typed = parts.filter((part) => !mine.some((m) => m.phrase === part || m.label === part)).join(', ');
  return { tapped: tapped.join(', '), typed };
}
