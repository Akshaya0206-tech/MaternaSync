import type { DoctorSearchResult, SearchDocument, SearchPatient, SearchQuestion } from '../../api/doctorSearch';
import { documentTitle } from './documentTitle';
import { formatFriendlyDate } from './format';

type Say = (text: string, values?: Record<string, string | number>) => string;

/** Fewer typed characters than this are not searched. */
export const MIN_QUERY = 2;
export const MAX_QUERY = 100;

// For comparing: lower case and without Latin accents. Hindi, Tamil and Telugu vowel signs are not in the block removed, so those scripts are
// compared exactly as written (the server does the same).
const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const cleanQuery = (text: string) => text.replace(/\s+/g, ' ').trim();

/** `text` cut into pieces, the pieces that match `query` marked, so the matched words can be shown in bold. */
export function highlightParts(text: string, query: string): { text: string; match: boolean }[] {
  const needle = fold(cleanQuery(query));
  if (needle.length < MIN_QUERY || !text) return [{ text, match: false }];
  // Fold one character at a time so a position in the folded text maps back to the original (accents can change the length).
  let folded = '';
  const starts: number[] = [];
  const ends: number[] = [];
  for (let at = 0; at < text.length; ) {
    const char = String.fromCodePoint(text.codePointAt(at)!);
    const piece = fold(char);
    for (let unit = 0; unit < piece.length; unit++) { starts.push(at); ends.push(at + char.length); }
    folded += piece;
    at += char.length;
  }
  const parts: { text: string; match: boolean }[] = [];
  let done = 0;
  for (let from = 0; ; ) {
    const hit = folded.indexOf(needle, from);
    if (hit < 0) break;
    const begin = starts[hit];
    const finish = ends[hit + needle.length - 1];
    if (begin >= done) {
      if (begin > done) parts.push({ text: text.slice(done, begin), match: false });
      parts.push({ text: text.slice(begin, finish), match: true });
      done = finish;
    }
    from = hit + needle.length;
  }
  if (done < text.length) parts.push({ text: text.slice(done), match: false });
  return parts.length ? parts : [{ text, match: false }];
}

export const documentLabel = (document: SearchDocument, t: Say) =>
  documentTitle({ description: document.description, documentType: document.documentType, documentDate: document.documentDate, filename: document.filename }, t);

const STATE_WORDS = {
  needs_reply: 'Needs your reply',
  answered: 'Answered',
  handled: 'Handled by phone or in clinic',
  closed: 'Closed',
} as const;

/** The small grey line under a result: who it is about, when, and anything that explains why it matched. Plain facts only. */
export function patientMeta(item: SearchPatient, t: Say): string {
  if (item.matchedOn === 'mrn' && item.detail) return t('Record number: {value}', { value: item.detail });
  if (item.matchedOn === 'phone' && item.detail) return t('Phone: {value}', { value: item.detail });
  return '';
}

export function questionMeta(item: SearchQuestion, t: Say): string {
  return [
    item.patientName,
    item.date ? formatFriendlyDate(item.date) : '',
    t(STATE_WORDS[item.state]),
    item.matchedOn === 'earlier' ? t('Follows a question that matched') : '',
  ].filter(Boolean).join(' · ');
}

export function documentMeta(item: SearchDocument, t: Say): string {
  return [item.patientName, item.date ? formatFriendlyDate(item.date) : '', item.matchedOn === 'filename' && item.detail ? t('File name: {value}', { value: item.detail }) : ''].filter(Boolean).join(' · ');
}

/** "3 patients, 2 questions, 1 document": what a screen reader is told when the results arrive. */
export function summaryText(result: DoctorSearchResult, query: string, t: Say): string {
  const parts = [
    result.patients.total ? (result.patients.total === 1 ? t('1 patient') : t('{count} patients', { count: result.patients.total })) : '',
    result.questions.total ? (result.questions.total === 1 ? t('1 question') : t('{count} questions', { count: result.questions.total })) : '',
    result.documents.total ? (result.documents.total === 1 ? t('1 document') : t('{count} documents', { count: result.documents.total })) : '',
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : t('No results for “{query}”', { query });
}
