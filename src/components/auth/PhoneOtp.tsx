import { useEffect, useState } from 'react';
import { ApiError } from '../../api/client';
import { fetchLoginPhone, removeLoginPhone, resendPhoneCode, startPhoneEnrollment, startPhoneSignIn, verifyPhoneEnrollment, verifyPhoneSignIn } from '../../api/auth';
import type { CurrentUser, LoginPhone, PhoneChallenge } from '../../api/auth';
import { useLanguage } from '../../i18n';
import { Field, inputStyle } from './AuthField';

const errorText = (err: unknown) => err instanceof ApiError && err.status !== 422 ? err.message : "Could not complete phone verification. Please try again.";
const formStyle = { display: 'grid', gap: 12 };

function useRetryDelay() {
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [until]);
  const remaining = Math.max(0, Math.ceil((until - now) / 1000));
  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = String(remaining % 60).padStart(2, '0');
  return {
    remaining,
    time: hours ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`,
    onError: (err: unknown) => {
      if (err instanceof ApiError && err.status === 429) {
        const current = Date.now();
        setNow(current);
        setUntil(current + Math.max(1, err.retryAfterSeconds ?? 60) * 1000);
      }
    },
  };
}

function CodeStep({ challenge, enrolling, onVerified, onBack }: {
  challenge: PhoneChallenge; enrolling: boolean; onVerified: (id: string, code: string) => Promise<void>; onBack: () => void;
}) {
  const { t } = useLanguage();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resendAt, setResendAt] = useState(() => Date.now() + challenge.resendAfter * 1000);
  const [now, setNow] = useState(() => Date.now());
  const [resent, setResent] = useState(false);
  const retry = useRetryDelay();
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const expired = now >= Date.parse(challenge.expiresAt);
  const remaining = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const resend = async () => {
    if (busy || expired || remaining > 0 || retry.remaining > 0) return;
    setBusy(true); setError(''); setResent(false);
    try {
      const next = await resendPhoneCode(challenge.challengeId, enrolling);
      setResendAt(Date.now() + next.resendAfter * 1000); setResent(true); setCode('');
    } catch (err) { setError(errorText(err)); retry.onError(err); }
    finally { setBusy(false); }
  };
  return <form style={formStyle} onSubmit={async e => {
    e.preventDefault(); if (busy || expired || retry.remaining > 0) return;
    setBusy(true); setError('');
    try { await onVerified(challenge.challengeId, code); }
    catch (err) { setError(errorText(err)); retry.onError(err); }
    finally { setBusy(false); }
  }}>
    <p role="status">{enrolling ? t('Enter the SMS code sent to {phone}.', { phone: challenge.maskedPhone }) : t('If this number is linked to an account, a code will arrive at {phone}.', { phone: challenge.maskedPhone })}</p>
    <p className="continuity-muted">{t('Codes expire after 5 minutes. Resending does not extend the time.')}</p>
    <Field label={t('Six-digit code')}><input style={inputStyle} autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e => setCode(e.target.value.replace(/[^0-9]/g, ''))} disabled={busy || expired} /></Field>
    {error && <p role="alert" className="continuity-alert">{t(error)}</p>}
    {expired && <p role="status">{t('This code has expired. Go back to request a new one.')}</p>}
    {resent && <p role="status">{t('Another code was requested. Please check your SMS inbox.')}</p>}
    <button type="submit" className="btn-primary" disabled={busy || expired || code.length !== 6 || retry.remaining > 0}>{busy ? t('Please wait…') : retry.remaining > 0 ? t('Try again in {time}', { time: retry.time }) : t('Verify code')}</button>
    <button type="button" className="btn-secondary" disabled={busy || expired || remaining > 0 || retry.remaining > 0} onClick={() => void resend()}>{retry.remaining > 0 ? t('Try again in {time}', { time: retry.time }) : remaining > 0 ? t('Resend in {seconds}s', { seconds: remaining }) : t('Resend code')}</button>
    <button type="button" className="btn-secondary" disabled={busy} onClick={onBack}>{t('Back')}</button>
  </form>;
}

export function PhoneSignIn({ onAuthenticated }: { onAuthenticated: (token: string, user: CurrentUser) => void }) {
  const { t } = useLanguage();
  const [phone, setPhone] = useState('');
  const [challenge, setChallenge] = useState<PhoneChallenge | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const retry = useRetryDelay();
  if (challenge) return <CodeStep challenge={challenge} enrolling={false} onBack={() => { setChallenge(null); setError(''); }} onVerified={async (id, code) => {
    const result = await verifyPhoneSignIn(id, code); onAuthenticated(result.accessToken, result.user);
  }} />;
  return <form style={formStyle} onSubmit={async e => {
    e.preventDefault(); if (busy || retry.remaining > 0) return; setBusy(true); setError('');
    try { setChallenge(await startPhoneSignIn(phone)); } catch (err) { setError(errorText(err)); retry.onError(err); } finally { setBusy(false); }
  }}>
    <p className="continuity-muted">{t('Enter the mobile number you linked in Profile.')}</p>
    <Field label={t('Mobile number (+91)')}><input type="tel" style={inputStyle} autoComplete="tel" required maxLength={30} value={phone} onChange={e => setPhone(e.target.value)} disabled={busy} /></Field>
    <p className="continuity-muted">{t('Requesting a code sends an SMS to this number.')}</p>
    {error && <p role="alert" className="continuity-alert">{t(error)}</p>}
    <button type="submit" className="btn-primary" disabled={busy || retry.remaining > 0}>{busy ? t('Please wait…') : retry.remaining > 0 ? t('Try again in {time}', { time: retry.time }) : t('Send sign-in code')}</button>
  </form>;
}

/** Shared by patient, doctor and caregiver Profile; numbers are never borrowed from clinical contact details. */
export function PhoneLoginSettings() {
  const { t } = useLanguage();
  const [status, setStatus] = useState<LoginPhone | null>(null);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [challenge, setChallenge] = useState<PhoneChallenge | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const retry = useRetryDelay();
  useEffect(() => { let active = true; fetchLoginPhone().then(value => { if (active) setStatus(value); }).catch(() => { if (active) setError('Could not complete phone verification. Please try again.'); }); return () => { active = false; }; }, []);
  if (status && !status.enabled && !status.maskedPhone) return null;
  return <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--border-color)' }}>
    <h3>{t('Phone sign-in')}</h3>
    {error && <p role="alert" className="continuity-alert">{t(error)}</p>}
    {done && <p role="status">{t('Your sign-in number was updated.')}</p>}
    {!status && !error && <p role="status">{t('Loading…')}</p>}
    {challenge ? <CodeStep challenge={challenge} enrolling onBack={() => { setChallenge(null); setError(''); }} onVerified={async (id, code) => {
      await verifyPhoneEnrollment(id, code); setStatus(await fetchLoginPhone()); setChallenge(null); setPassword(''); setDone(true);
    }} /> : status && <form style={formStyle} onSubmit={async e => {
      e.preventDefault(); if (busy || retry.remaining > 0) return; setBusy(true); setError(''); setDone(false);
      try {
        if (status.maskedPhone) { await removeLoginPhone(password); setStatus(await fetchLoginPhone()); setDone(true); }
        else setChallenge(await startPhoneEnrollment(phone, password));
        setPassword('');
      } catch (err) { setError(errorText(err)); retry.onError(err); } finally { setBusy(false); }
    }}>
      {status.maskedPhone ? <p>{t('Linked sign-in number: {phone}', { phone: status.maskedPhone })}</p> : <>
        <p className="continuity-muted">{t('Link a number you control to sign in with SMS. Your password still works.')}</p>
        <Field label={t('Mobile number (+91)')}><input type="tel" autoComplete="tel" style={inputStyle} required maxLength={30} value={phone} onChange={e => setPhone(e.target.value)} disabled={busy} /></Field>
        <p className="continuity-muted">{t('Requesting a code sends an SMS to this number.')}</p>
      </>}
      <Field label={t('Current password')}><input type="password" autoComplete="current-password" style={inputStyle} required value={password} onChange={e => setPassword(e.target.value)} disabled={busy} /></Field>
      <button type="submit" className="btn-secondary" disabled={busy || retry.remaining > 0}>{busy ? t('Please wait…') : retry.remaining > 0 ? t('Try again in {time}', { time: retry.time }) : status.maskedPhone ? t('Remove sign-in number') : t('Send verification code')}</button>
    </form>}
  </div>;
}
