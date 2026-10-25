import { useEffect, useState } from 'react';
import { caregiverWhatsApp, confirmCaregiverWhatsApp, startCaregiverWhatsApp, turnOffCaregiverWhatsApp } from '../../api/caregiver';
import type { CaregiverWhatsAppStatus } from '../../api/caregiver';
import { Feedback, Field, Panel, useAction } from '../../components/continuity/shared';
import { useLanguage } from '../../i18n';
import { formatFriendlyDate } from '../patient/format';

/** Short WhatsApp reminders on the trusted person's own number. They type the number, receive a one-time code on it and type the code back,
 *  so nobody can be signed up by someone else. The message only asks them to sign in; it never has her name, results or medicines. */
export function CaregiverWhatsAppCard({ linkId, womanName }: { linkId: string; womanName: string }) {
  const { t } = useLanguage();
  const action = useAction();
  const [status, setStatus] = useState<CaregiverWhatsAppStatus | null>(null);
  const [number, setNumber] = useState('');
  const [code, setCode] = useState('');
  const [demoCode, setDemoCode] = useState<string | null>(null);

  useEffect(() => {
    setStatus(null);
    caregiverWhatsApp(linkId).then(setStatus).catch(() => setStatus(null));
  }, [linkId]);

  // Nothing to be reminded about unless she has allowed visits or check-ins.
  if (!status || (!status.visits && !status.checkIns)) return null;
  const first = womanName.split(' ')[0];

  const start = () =>
    action.run(async () => {
      const next = await startCaregiverWhatsApp(linkId, number);
      setDemoCode(next.demoCode ?? null);
      setCode('');
      setStatus(next);
    }, t('We sent a code. Type it below.'));
  const confirm = () =>
    action.run(async () => {
      setStatus(await confirmCaregiverWhatsApp(linkId, code));
      setCode('');
      setNumber('');
      setDemoCode(null);
    }, t('WhatsApp reminders are on.'));
  const turnOff = (message: string) =>
    action.run(async () => {
      setStatus(await turnOffCaregiverWhatsApp(linkId));
      setDemoCode(null);
      setCode('');
    }, message);

  return (
    <Panel title={t('WhatsApp reminders')}>
      <Feedback error={action.error} message={action.message} />
      <p>
        {t('Get a short WhatsApp message before {name}’s visits and when a check-in is waiting. It only asks you to sign in: it never has her name, results or medicines.', { name: first })}
      </p>
      <p className="continuity-muted">
        {t('She is told when you turn this on or off. It stops if she removes you or your access ends, and you can turn it off at any time.')}
      </p>

      {!status.available && <p className="continuity-note">{t('WhatsApp sending is not set up on this server, so this cannot be turned on yet.')}</p>}

      {status.available && status.status === 'off' && (
        <form onSubmit={(e) => { e.preventDefault(); void start(); }}>
          <Field label={t('Your WhatsApp number, with the country code')}>
            <input type="tel" inputMode="tel" autoComplete="tel" required placeholder="+919812345678" value={number} onChange={(e) => setNumber(e.target.value)} />
          </Field>
          <button className="btn-primary" disabled={action.busy || number.trim().length < 8}>{t('Send me a code')}</button>
        </form>
      )}

      {status.available && status.status === 'waiting' && (
        <form onSubmit={(e) => { e.preventDefault(); void confirm(); }}>
          <p role="status">{t('We sent a 6-digit code to {number}. It works for 10 minutes.', { number: status.number ?? '' })}</p>
          {demoCode && <p className="continuity-note" role="status">{t('Demonstration: no phone receives the code, so it is shown here. Your code is {code}.', { code: demoCode })}</p>}
          <Field label={t('The 6-digit code')}>
            <input inputMode="numeric" autoComplete="one-time-code" required maxLength={6} pattern="[0-9]{6}" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
          </Field>
          <div className="continuity-actions">
            <button className="btn-primary" disabled={action.busy || code.length !== 6}>{t('Turn on')}</button>
            <button type="button" className="btn-secondary" disabled={action.busy} onClick={() => void turnOff(t('Cancelled. You can start again.'))}>{t('Start again')}</button>
          </div>
        </form>
      )}

      {status.available && status.status === 'on' && (
        <>
          <p role="status">
            <strong>{t('On for {number}.', { number: status.number ?? '' })}</strong>{' '}
            {status.expiresAt ? t('You will need to confirm again after {date}.', { date: formatFriendlyDate(status.expiresAt) }) : ''}
          </p>
          <p className="continuity-muted">
            {[status.visits ? t('her visits') : '', status.checkIns ? t('her check-ins') : ''].filter(Boolean).join(' · ')}
          </p>
          <button type="button" className="btn-secondary" disabled={action.busy} onClick={() => void turnOff(t('WhatsApp reminders are off.'))}>{t('Turn off')}</button>
        </>
      )}
    </Panel>
  );
}
