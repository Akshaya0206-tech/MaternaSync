import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer } from 'lucide-react';
import { formatTime } from '../../api/continuity';
import type { DailyLog } from '../../api/continuity';
import { tx, useLanguage } from '../../i18n';
import { Field } from '../../components/continuity/shared';

const MOODS: Record<string, string> = {
  not_recorded: tx('Not recorded'),
  good: tx('Good'),
  okay: tx('Okay'),
  low: tx('Low'),
  anxious: tx('Anxious'),
};
const ADHERENCE: Record<string, string> = {
  not_recorded: tx('Not recorded'),
  done: tx('Done'),
  skipped: tx('Skipped'),
  needs_help: tx('I need help'),
  not_applicable: tx('Not applicable'),
};
const RANGES = [
  { value: '14', label: tx('Last 2 weeks') },
  { value: '30', label: tx('Last 30 days') },
  { value: 'all', label: tx('All my entries') },
];

/** A plain list of her own entries to take to a visit. On screen only the two controls show; the list itself shows only when printing
 *  (or saving as a PDF). It repeats what she entered, in her words, with no marks, colours or comments on any value. */
export function EntriesPrint({ logs, patientName }: { logs: DailyLog[]; patientName: string }) {
  const { t } = useLanguage();
  const [range, setRange] = useState('30');
  const chosen = logs
    .filter((log) => range === 'all' || new Date(log.recordedAt).getTime() >= Date.now() - Number(range) * 86_400_000)
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());

  useEffect(() => {
    const done = () => document.body.classList.remove('printing-entries');
    window.addEventListener('afterprint', done);
    return () => { window.removeEventListener('afterprint', done); done(); };
  }, []);

  const print = () => {
    document.body.classList.add('printing-entries');
    window.print();
  };

  return (
    <>
      <div className="entries-print-controls">
        <Field label={t('Entries to print')}>
          <select value={range} onChange={(e) => setRange(e.target.value)}>
            {RANGES.map((item) => <option key={item.value} value={item.value}>{t(item.label)}</option>)}
          </select>
        </Field>
        <button type="button" className="btn-secondary" disabled={!chosen.length} onClick={print}>
          <Printer size={15} aria-hidden="true" /> {t('Print my entries')}
        </button>
      </div>
      {createPortal(
      <section className="entries-sheet" aria-label={t('My check-in entries')}>
        <h2>{t('My check-in entries')}</h2>
        <p>{patientName} · {t('Printed on {date}', { date: formatTime(new Date().toISOString()) })}</p>
        <p>{t('I entered these myself. A doctor has not checked them.')}</p>
        {chosen.length === 0 ? (
          <p>{t('No entries in this time.')}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">{t('Date and time')}</th>
                <th scope="col">{t('Blood pressure (mmHg)')}</th>
                <th scope="col">{t('Weight (kg)')}</th>
                <th scope="col">{t('Symptoms')}</th>
                <th scope="col">{t('Mood')}</th>
                <th scope="col">{t('Adherence')}</th>
                <th scope="col">{t('Movements')}</th>
              </tr>
            </thead>
            <tbody>
              {chosen.map((log) => (
                <tr key={log.id}>
                  <td>{formatTime(log.recordedAt)}</td>
                  <td>{log.skipped ? t('Skipped') : log.systolic != null ? `${log.systolic}/${log.diastolic}` : '–'}</td>
                  <td>{!log.skipped && log.weightKg != null ? log.weightKg : '–'}</td>
                  <td>{log.skipped ? t('Skipped') : log.symptoms || '–'}</td>
                  <td>{log.skipped || log.mood === 'not_recorded' ? '–' : t(MOODS[log.mood] ?? log.mood)}</td>
                  <td>{log.skipped || log.adherence === 'not_recorded' ? '–' : t(ADHERENCE[log.adherence] ?? log.adherence)}</td>
                  <td>{log.movementCount != null ? t('{count} movements over {minutes} minutes', { count: log.movementCount, minutes: log.movementMinutes ?? 0 }) : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>,
      document.body,
      )}
    </>
  );
}
