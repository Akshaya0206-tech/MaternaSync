import { useEffect, useState } from 'react';
import { getSchedulingRules, saveSchedulingRules } from '../../api/assistant';
import type { SchedulingRules } from '../../api/assistant';
import { Feedback, Field, Panel, useAction } from '../../components/continuity/shared';
import { tx, useLanguage } from '../../i18n';

// The server sends English weekday names; the page translates them through t().
const WEEKDAY_TEXT: Record<string, string> = {
  Monday: tx('Monday'), Tuesday: tx('Tuesday'), Wednesday: tx('Wednesday'), Thursday: tx('Thursday'),
  Friday: tx('Friday'), Saturday: tx('Saturday'), Sunday: tx('Sunday'),
};

/** The clinic's booking rules: the days, hours and visit length the assistant checks a visit request against. A doctor sets them. */
export function AssistantBookingRules() {
  const { t } = useLanguage();
  const action = useAction();
  const [rules, setRules] = useState<SchedulingRules | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getSchedulingRules().then(setRules).catch((err) => setError(err instanceof Error ? err.message : ''));
  }, []);

  if (!rules) return error ? <p role="alert" className="continuity-error">{error}</p> : null;

  const update = (change: Partial<SchedulingRules>) => setRules({ ...rules, ...change });
  const number = (value: string) => (value === '' ? 0 : Number(value));
  const save = () =>
    action.run(async () => {
      if (!rules.days.length) throw new Error(t('Choose at least one day.'));
      setRules(await saveSchedulingRules(rules));
    }, t('Booking rules saved.'));

  return (
    <Panel title={t('Booking rules')}>
      <Feedback error={action.error} message={action.message} />
      <p className="continuity-muted">
        {t("The assistant checks every visit request against these rules and against visits already booked. A request inside them becomes a proposal to confirm; one outside them becomes a proposal to offer the next free times. Nothing about a patient's health is looked at. Changing the rules never moves a visit that is already booked.")}
      </p>
      <fieldset className="assistant-days">
        <legend>{t('Days the clinic sees patients')}</legend>
        {rules.weekdays.map((name, day) => (
          <label className="continuity-check" key={name}>
            <input
              type="checkbox"
              checked={rules.days.includes(day)}
              onChange={(e) => update({ days: e.target.checked ? [...rules.days, day].sort() : rules.days.filter((d) => d !== day) })}
            />
            {t(WEEKDAY_TEXT[name] ?? name)}
          </label>
        ))}
      </fieldset>
      <div className="continuity-fields">
        <Field label={t('Opens')}><input type="time" value={rules.start} onChange={(e) => update({ start: e.target.value })} /></Field>
        <Field label={t('Closes')}><input type="time" value={rules.end} onChange={(e) => update({ end: e.target.value })} /></Field>
        <Field label={t('Minutes for each visit')}><input type="number" min={10} max={240} value={rules.minutes} onChange={(e) => update({ minutes: number(e.target.value) })} /></Field>
        <Field label={t('Notice needed (hours)')}><input type="number" min={0} max={168} value={rules.noticeHours} onChange={(e) => update({ noticeHours: number(e.target.value) })} /></Field>
        <Field label={t('Clinic clock, minutes ahead of UTC')}><input type="number" min={-720} max={840} value={rules.offsetMinutes} onChange={(e) => update({ offsetMinutes: number(e.target.value) })} /></Field>
        <Field label={t('Hours to wait after a visit before asking whether she came')}><input type="number" min={0} max={48} value={rules.graceHours} onChange={(e) => update({ graceHours: number(e.target.value) })} /></Field>
      </div>
      <p className="continuity-muted">{t('India Standard Time is 330 minutes ahead of UTC.')}</p>
      <div className="continuity-actions">
        <button className="btn-primary" disabled={action.busy} onClick={() => void save()}>{t('Save booking rules')}</button>
      </div>
    </Panel>
  );
}
