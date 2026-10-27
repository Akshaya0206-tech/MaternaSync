import { typeLabel } from '../patient/documentTypes';
import { formatFriendlyDate } from './format';

type Say = (text: string, values?: Record<string, string | number>) => string;

/** A readable title for a record, the same way the patient's own My Records page names it: what she wrote about it, else the kind she chose with
 *  its date, else the file's own name (which is often only a reference such as MSG-9921). */
export function documentTitle(
  document: { description?: string | null; documentType?: string | null; documentDate?: string | null; filename: string },
  t: Say,
): string {
  const description = document.description?.trim();
  if (description) return description;
  if (document.documentType) {
    const kind = t(typeLabel(document.documentType));
    return document.documentDate ? `${kind} · ${formatFriendlyDate(document.documentDate)}` : kind;
  }
  return document.filename;
}
