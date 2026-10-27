import { useRef, useState } from 'react';
import { LogOut } from 'lucide-react';
import { ApiError } from '../../api/client';
import { changePassword, signOutOtherDevices } from '../../api/account';
import { useAuth } from '../../auth/AuthContext';
import { Field } from '../../components/continuity/shared';
import { tx, useLanguage } from '../../i18n';
import './doctor-profile.css';

// The same two actions, on the same server routes and with the same wording, as the patient's Security card (src/roles/patient/AccountCards.tsx).
// Changing the password, or "Sign out other devices", ends every other session and hands back a fresh sign-in for THIS device.
const WRONG_CURRENT = tx('Your current password is not right.');
const NO_MATCH = tx('Your new password and its confirmation do not match.');
const TOO_SHORT = tx('Your new password must be at least 8 characters.');
const SAME_AS_OLD = tx('Choose a new password that is different from your current one.');
const textOf = (error: unknown, fallback: string) => (error instanceof ApiError && error.status < 500 && error.status !== 422 ? error.message : fallback);
const focusFirstMarked = (root: HTMLElement | null) => window.setTimeout(() => root?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0);

export function DoctorSecurityCard() {
  const { t } = useLanguage();
  const { login } = useAuth();
  const form = useRef<HTMLFormElement>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [errors, setErrors] = useState<{ current?: string; next?: string; again?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const [othersBusy, setOthersBusy] = useState(false);
  const [othersDone, setOthersDone] = useState('');
  const [othersError, setOthersError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDone('');
    const found: typeof errors = {};
    if (!current) found.current = tx('Enter your current password.');
    if (next.length < 8) found.next = TOO_SHORT;
    else if (next === current) found.next = SAME_AS_OLD;
    if (again !== next) found.again = NO_MATCH;
    if (Object.keys(found).length) {
      setErrors(found);
      focusFirstMarked(form.current);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const fresh = await changePassword(current, next, again);
      login(fresh.accessToken, fresh.user); // this device keeps working; every other one was signed out
      setCurrent('');
      setNext('');
      setAgain('');
      setDone(tx('Your password was changed. You were signed out on every other device.'));
    } catch (error) {
      const text = textOf(error, tx('Could not change your password. Please try again.'));
      setErrors(text === WRONG_CURRENT ? { current: text } : text === NO_MATCH ? { again: text } : text === TOO_SHORT || text === SAME_AS_OLD ? { next: text } : { form: text });
      focusFirstMarked(form.current);
    } finally {
      setBusy(false);
    }
  };

  const signOutOthers = async () => {
    setOthersDone('');
    setOthersError('');
    setOthersBusy(true);
    try {
      const fresh = await signOutOtherDevices();
      login(fresh.accessToken, fresh.user);
      setOthersDone(tx('You were signed out on every other device.'));
    } catch (error) {
      setOthersError(textOf(error, tx('Could not sign you out of the other devices. Please try again.')));
    } finally {
      setOthersBusy(false);
    }
  };

  return (
    <section className="glass-panel continuity-panel doctor-profile-card" aria-labelledby="doctor-security-title">
      <div className="continuity-panel-heading"><h2 id="doctor-security-title">{t('Security')}</h2></div>
      <p className="continuity-muted">{t('Change your password, or sign out of your account on every other phone and computer.')}</p>
      <form ref={form} noValidate onSubmit={(e) => void submit(e)} aria-label={t('Change password')}>
        <div className="continuity-fields">
          <Field label={t('Current password')} error={errors.current && t(errors.current)}>
            <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </Field>
          <Field label={t('New password')} error={errors.next && t(errors.next)}>
            <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
          </Field>
          <Field label={t('Type the new password again')} error={errors.again && t(errors.again)}>
            <input type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
          </Field>
        </div>
        <p className="continuity-muted">{t('At least 8 characters. Changing your password signs you out on every other device. You stay signed in here.')}</p>
        {errors.form && <div role="alert" className="continuity-alert">{t(errors.form)}</div>}
        <div className="continuity-actions">
          <button type="submit" className="btn-primary" disabled={busy}>{busy ? t('Saving…') : t('Change password')}</button>
        </div>
        {done && <div role="status" className="continuity-success">{t(done)}</div>}
      </form>

      <h3 style={{ marginTop: 18 }}>{t('Sign out other devices')}</h3>
      <p className="continuity-muted">{t('This keeps you signed in here and signs you out on every other phone and computer.')}</p>
      <div className="continuity-actions">
        <button type="button" className="btn-secondary" disabled={othersBusy} onClick={() => void signOutOthers()}>
          <LogOut size={16} aria-hidden="true" /> {t('Sign out other devices')}
        </button>
      </div>
      {othersError && <div role="alert" className="continuity-alert">{t(othersError)}</div>}
      {othersDone && <div role="status" className="continuity-success">{t(othersDone)}</div>}
    </section>
  );
}
