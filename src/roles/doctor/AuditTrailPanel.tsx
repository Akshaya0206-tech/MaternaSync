import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Printer } from 'lucide-react';
import { fetchAuditTrail, noteAuditExport } from '../../api/doctorWorkspace';
import type { AuditFilters, AuditKind, AuditRow, AuditWho } from '../../api/doctorWorkspace';
import { Feedback, Field, useAction } from '../../components/continuity/shared';
import { tx, useLanguage } from '../../i18n';
import { formatFriendlyDateTime } from './format';
import { auditSentence } from './auditActions';

// The audit trail of one patient, read-only: who saw or changed what, and when. Opening it is not recorded (it would bury everything else);
// printing or saving a copy is, so that taking a copy leaves its own trace.
const WHO_LABELS: Record<AuditWho, string> = {
  patient: tx('The patient'),
  doctor: tx('A doctor'),
  trusted_person: tx('A trusted person'),
  assistant: tx('The care assistant'),
  other: tx('Someone else (care team)'),
};
const ROLE_LABELS: Record<string, string> = {
  patient: tx('Patient'),
  doctor: tx('Doctor'),
  caregiver: tx('Trusted person'),
  care_team: tx('Care team'),
  ai_coordinator: tx('Care assistant'),
  system: tx('Care assistant'),
};
const KIND_LABELS: Record<AuditKind, string> = {
  checkins: tx('Check-ins'),
  documents: tx('Documents'),
  questions: tx('Questions'),
  visits: tx('Visits, reminders and tasks'),
  consents: tx('Consents and sharing'),
  trusted: tx('Trusted people'),
  approved: tx('Notes and documents the doctor approved'),
  account: tx('Account'),
  other: tx('Everything else'),
};
const OBJECT_LABELS: Record<string, string> = {
  MedicalDocument: tx('Document'),
  PatientQuestion: tx('Question'),
  Appointment: tx('Visit'),
  CareReminder: tx('Reminder'),
  Task: tx('Task'),
  DailyLog: tx('Check-in'),
  ClinicalOutput: tx('Document draft'),
  Consultation: tx('Consultation'),
  SharingConsent: tx('Permission'),
  CaregiverLink: tx('Trusted person'),
  Referral: tx('Referral'),
};
const PAGE = 25;
const EXPORT_PAGE = 100;
const MOST_EXPORTED = 2000;

/** A spreadsheet reads a cell that starts with = + - or @ as a formula, so free text that starts that way gets a quote in front. */
const safeText = (value: string) => (/^[=+\-@\t\r]/.test(value) ? `'${value}` : value);
const cell = (value: string | number | null | undefined) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const stamp = (iso: string | null) => {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export function AuditTrailPanel({ episodeId, patientName }: { episodeId: string; patientName: string }) {
  const { t } = useLanguage();
  const action = useAction();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [who, setWho] = useState<AuditWho | ''>('');
  const [kind, setKind] = useState<AuditKind | ''>('');
  const [includeViews, setIncludeViews] = useState(false);
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sheet, setSheet] = useState<AuditRow[] | null>(null);

  const filters: AuditFilters = { dateFrom, dateTo, who, kind, includeViews };
  const filtering = Boolean(dateFrom || dateTo || who || kind || includeViews);

  useEffect(() => {
    const done = () => document.body.classList.remove('printing-entries');
    window.addEventListener('afterprint', done);
    return () => { window.removeEventListener('afterprint', done); done(); };
  }, []);

  // A new choice of filters starts the list again from the newest row.
  const load = useCallback(() => {
    let current = true;
    setLoading(true);
    setError('');
    fetchAuditTrail(episodeId, { dateFrom, dateTo, who, kind, includeViews }, PAGE, 0)
      .then((page) => { if (current) { setRows(page.items); setTotal(page.total); } })
      .catch(() => { if (current) setError(tx('We couldn’t load the audit trail. Please try again.')); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [episodeId, dateFrom, dateTo, who, kind, includeViews]);
  useEffect(() => load(), [load]);

  const showMore = () =>
    action.run(async () => {
      const page = await fetchAuditTrail(episodeId, filters, PAGE, rows.length);
      setRows((old) => [...old, ...page.items]);
      setTotal(page.total);
    }, '');

  const clear = () => { setDateFrom(''); setDateTo(''); setWho(''); setKind(''); setIncludeViews(false); };

  const whoText = (row: AuditRow) => {
    if (row.who === 'assistant') return t('Care assistant');
    const name = row.whoName || t(ROLE_LABELS[row.whoRole] ?? row.whoRole);
    return row.loginOff ? t('{name} (care-team account, login off)', { name }) : name;
  };
  const roleText = (row: AuditRow) => (row.who === 'assistant' ? t('Care assistant') : t(ROLE_LABELS[row.whoRole] ?? WHO_LABELS[row.who]));
  const aboutText = (row: AuditRow) => {
    const type = row.objectType ? OBJECT_LABELS[row.objectType] : undefined;
    return [type ? t(type) : '', row.objectLabel ?? ''].filter(Boolean).join(': ');
  };
  const changesText = (row: AuditRow) => row.changes.map((c) => `${c.field}: ${c.before ?? '–'} → ${c.after ?? '–'}`).join('; ');

  // Every row that matches the filters, up to a limit, not only the ones on screen.
  const everything = async (): Promise<AuditRow[]> => {
    const all: AuditRow[] = [];
    for (let offset = 0; offset < MOST_EXPORTED; offset += EXPORT_PAGE) {
      const page = await fetchAuditTrail(episodeId, filters, EXPORT_PAGE, offset);
      all.push(...page.items);
      if (!page.hasMore) break;
    }
    return all;
  };
  const filterNote = () => ({
    from: dateFrom, to: dateTo, who, kind, views: includeViews ? 'yes' : 'no',
  });

  const print = () =>
    action.run(async () => {
      const list = await everything();
      await noteAuditExport(episodeId, 'print', list.length, filterNote());
      setSheet(list);
      // The list is drawn first; the print window opens on the next turn so it has something to print.
      window.setTimeout(() => { document.body.classList.add('printing-entries'); window.print(); }, 60);
    }, '');

  const download = () =>
    action.run(async () => {
      const list = await everything();
      await noteAuditExport(episodeId, 'csv', list.length, filterNote());
      const header = [t('Date and time'), t('Who'), t('Role'), t('Care-team account, login off'), t('What happened'), t('Kind'), t('About'), t('Details'), t('What changed')];
      const lines = list.map((row) => [
        stamp(row.at), safeText(whoText(row)), roleText(row), row.loginOff ? t('Yes') : t('No'), safeText(auditSentence(row, t)), t(KIND_LABELS[row.kind]),
        safeText(aboutText(row)), safeText(row.details), safeText(changesText(row)),
      ].map(cell).join(','));
      // The byte-order mark makes a spreadsheet open Hindi, Tamil and Telugu text correctly.
      const blob = new Blob(['﻿' + [header.map(cell).join(','), ...lines].join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit-trail-${patientName.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'patient'}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, t('The file was saved to your downloads.'));

  const filterWords = () => [
    dateFrom || dateTo ? `${t('From')} ${dateFrom || '…'} ${t('To')} ${dateTo || '…'}` : '',
    who ? `${t('Who')}: ${t(WHO_LABELS[who])}` : '',
    kind ? `${t('Kind')}: ${t(KIND_LABELS[kind])}` : '',
    includeViews ? t('Page views included') : '',
  ].filter(Boolean).join(' · ');

  return (
    <div className="audit-trail">
      <p className="continuity-muted">
        {t('A record of who saw or changed what for this patient. It is read-only: nothing here can be edited or deleted. Opening it is not recorded; printing or saving a copy is.')}
      </p>

      <div className="glass-panel audit-filters" role="group" aria-label={t('Choose what to show')}>
        <Field label={t('From')}>
          <input type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => setDateFrom(e.target.value)} />
        </Field>
        <Field label={t('To')}>
          <input type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)} />
        </Field>
        <Field label={t('Who')}>
          <select value={who} onChange={(e) => setWho(e.target.value as AuditWho | '')}>
            <option value="">{t('Anyone')}</option>
            {(Object.keys(WHO_LABELS) as AuditWho[]).map((key) => <option key={key} value={key}>{t(WHO_LABELS[key])}</option>)}
          </select>
        </Field>
        <Field label={t('Kind')}>
          <select value={kind} onChange={(e) => setKind(e.target.value as AuditKind | '')}>
            <option value="">{t('Everything')}</option>
            {(Object.keys(KIND_LABELS) as AuditKind[]).map((key) => <option key={key} value={key}>{t(KIND_LABELS[key])}</option>)}
          </select>
        </Field>
        <label className="continuity-check audit-views">
          <input type="checkbox" checked={includeViews} onChange={(e) => setIncludeViews(e.target.checked)} />
          {t('Include page views and routine checks')}
        </label>
        {filtering && <button type="button" className="btn-secondary" onClick={clear}>{t('Clear filters')}</button>}
      </div>

      <div className="audit-bar">
        <span className="continuity-muted" role="status">
          {loading ? t('Loading the audit trail…') : t('Showing {shown} of {total}', { shown: rows.length, total })}
        </span>
        <span className="audit-bar-buttons">
          <button type="button" className="btn-secondary" disabled={action.busy || loading || total === 0} onClick={() => void print()}>
            <Printer size={15} aria-hidden="true" /> {t('Print')}
          </button>
          <button type="button" className="btn-secondary" disabled={action.busy || loading || total === 0} onClick={() => void download()}>
            <Download size={15} aria-hidden="true" /> {t('Download CSV')}
          </button>
        </span>
      </div>
      <Feedback error={error ? t(error) : action.error} message={action.message} />

      {!loading && !error && rows.length === 0 && (
        <div className="glass-panel audit-empty">{filtering ? t('Nothing was recorded that matches these choices.') : t('Nothing has been recorded for this patient yet.')}</div>
      )}

      {rows.length > 0 && (
        <ol className="audit-list" aria-label={t('Audit trail')}>
          {rows.map((row) => {
            const about = aboutText(row);
            const changes = changesText(row);
            return (
              <li key={row.id} className="glass-panel audit-row">
                <div className="audit-when">{formatFriendlyDateTime(row.at)}</div>
                <div className="audit-main">
                  <div className="audit-what">{auditSentence(row, t)}</div>
                  <div className="audit-meta">
                    <span>{whoText(row)}</span>
                    <span className="audit-role">{roleText(row)}</span>
                    {about && <span>{about}</span>}
                    <span className="audit-kind">{t(KIND_LABELS[row.kind])}</span>
                  </div>
                  {(row.details || changes) && (
                    <details className="audit-details">
                      <summary>{t('Details')}</summary>
                      {row.details && <p>{row.details}</p>}
                      {changes && <p className="audit-changes">{changes}</p>}
                    </details>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {!loading && rows.length < total && (
        <div className="continuity-actions">
          <button type="button" className="btn-secondary" disabled={action.busy} onClick={() => void showMore()}>
            {t('Show more ({count} more)', { count: total - rows.length })}
          </button>
        </div>
      )}

      {sheet && createPortal(
        <section className="entries-sheet" aria-label={t('Audit trail')}>
          <h2>{t('Audit trail')}</h2>
          <p>{patientName} · {t('Printed on {date}', { date: formatFriendlyDateTime(new Date().toISOString()) })}</p>
          <p>{t('A read-only record of who saw or changed what for this patient.')}{filterWords() ? ` ${filterWords()}` : ''}</p>
          {sheet.length === 0 ? (
            <p>{t('Nothing was recorded that matches these choices.')}</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th scope="col">{t('Date and time')}</th><th scope="col">{t('Who')}</th><th scope="col">{t('What happened')}</th><th scope="col">{t('About')}</th><th scope="col">{t('Details')}</th>
                </tr>
              </thead>
              <tbody>
                {sheet.map((row) => (
                  <tr key={row.id}>
                    <td>{formatFriendlyDateTime(row.at)}</td>
                    <td>{whoText(row)} · {roleText(row)}</td>
                    <td>{auditSentence(row, t)}</td>
                    <td>{aboutText(row) || '–'}</td>
                    <td>{[row.details, changesText(row)].filter(Boolean).join(' ') || '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>,
        document.body,
      )}
    </div>
  );
}
