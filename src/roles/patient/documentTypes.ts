import { tx } from '../../i18n';

/** What a patient can say a file is when she uploads it. The values are what the server keeps (backend/app/document_types.py). */
export const DOCUMENT_TYPES = [
  { value: 'lab_report', label: tx('Lab report') },
  { value: 'scan', label: tx('Scan or ultrasound') },
  { value: 'prescription', label: tx('Prescription') },
  { value: 'discharge_summary', label: tx('Discharge summary') },
  { value: 'vaccination_card', label: tx('Vaccination card') },
  { value: 'visit_note', label: tx('Visit note') },
  { value: 'other', label: tx('Other') },
] as const;

/** A record with no type yet (uploaded before types existed) shows this neutral label. */
export const UNTYPED_LABEL = tx('Record');

export const typeLabel = (value: string | null | undefined): string => DOCUMENT_TYPES.find((type) => type.value === value)?.label ?? UNTYPED_LABEL;
