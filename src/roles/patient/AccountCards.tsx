import { useEffect, useRef, useState } from 'react';
import { Download, KeyRound, LogOut, UserX } from 'lucide-react';
import { ApiError } from '../../api/client';
import { changePassword, closeMyAccount, downloadMyData, signOutOtherDevices } from '../../api/account';
import { useAuth } from '../../auth/AuthContext';
import { tx, useLanguage } from '../../i18n';
import { Field } from '../../components/continuity/shared';
import { CardHeading } from './ProfileArt';
import { cardProps } from './profileCard';

// The cards for her account on Profile: Security, My data and Close my account. The server's own sentences (the keys below are exactly what it sends)
// are translated when shown, so a refusal reads in her language.
const WRONG_CURRENT = tx('Your current password is not right.');
const NO_MATCH = tx('Your new password and its confirmation do not match.');
const TOO_SHORT = tx('Your new password must be at least 8 characters.');
const SAME_AS_OLD = tx('Choose a new password that is different from your current one.');
const WRONG_TO_CLOSE = tx('Your password is not right.');
const NOT_CONFIRMED = tx('Please confirm that you want to close your account.');
const textOf = (error: unknown, fallback: string) => (error instanceof ApiError && error.status < 500 && error.status !== 422 ? error.message : fallback);

/** Moves the cursor to the first box that has been marked, once the marks have been drawn. */
const focusFirstMarked = (root: HTMLElement | null) => window.setTimeout(() => root?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0);

export function SecurityCard({ index }: { index: number }) {
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
    <section aria-labelledby="profile-security-title" {...cardProps('navy', index, 'pf-account')}>
      <CardHeading
        id="profile-security-title"
        icon={<KeyRound size={23} />}
        title={t('Security')}
        subtitle={t('Change your password, or sign out of your account on every other phone and computer.')}
      />
      <form ref={form} noValidate onSubmit={(e) => void submit(e)} aria-label={t('Change password')}>
        <div className="pf-account-fields">
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
        {errors.form && <div role="alert" className="pf-error">{t(errors.form)}</div>}
        <div className="pf-actions">
          <button type="submit" className="btn-primary" disabled={busy}>{busy ? t('Saving…') : t('Change password')}</button>
        </div>
        {done && <div role="status" className="continuity-success">{t(done)}</div>}
      </form>

      <div className="pf-account-split">
        <h3>{t('Sign out other devices')}</h3>
        <p className="continuity-muted">{t('This keeps you signed in here and signs you out on every other phone and computer.')}</p>
        <div className="pf-actions">
          <button type="button" className="btn-secondary" disabled={othersBusy} onClick={() => void signOutOthers()}>
            <LogOut size={16} aria-hidden="true" /> {t('Sign out other devices')}
          </button>
        </div>
        {othersError && <div role="alert" className="pf-error">{t(othersError)}</div>}
        {othersDone && <div role="status" className="continuity-success">{t(othersDone)}</div>}
      </div>
    </section>
  );
}

export function MyDataCard({ index }: { index: number }) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const download = async () => {
    setBusy(true);
    setDone(false);
    setError('');
    try {
      await downloadMyData();
      setDone(true);
    } catch {
      setError(tx("We couldn't prepare your file. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="profile-my-data" aria-labelledby="profile-data-title" {...cardProps('sage', index, 'pf-account')}>
      <CardHeading
        id="profile-data-title"
        icon={<Download size={23} />}
        title={t('My data')}
        subtitle={t('Download a copy of your details, check-ins, questions, visits, documents and settings in one file.')}
      />
      <div className="pf-actions">
        <button type="button" className="btn-primary" disabled={busy} onClick={() => void download()}>
          <Download size={16} aria-hidden="true" /> {busy ? t('Preparing your file…') : t('Download all my data')}
        </button>
      </div>
      {error && <div role="alert" className="pf-error">{t(error)}</div>}
      {done && <div role="status" className="continuity-success">{t('Your file was saved to your downloads. It is not locked, so keep it somewhere safe.')}</div>}
    </section>
  );
}

export function CloseAccountCard({ index }: { index: number }) {
  const { t } = useLanguage();
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [closed, setClosed] = useState(false);
  const [password, setPassword] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; understood?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  // Focus follows what appears: the password box when the confirm step opens, the opening button when it is cancelled, the notice when it is done.
  useEffect(() => {
    if (open) form.current?.querySelector<HTMLInputElement>('input[type="password"]')?.focus();
  }, [open]);
  useEffect(() => {
    if (closed) heading.current?.focus();
  }, [closed]);

  const cancel = () => {
    setOpen(false);
    setPassword('');
    setUnderstood(false);
    setErrors({});
    window.setTimeout(() => opener.current?.focus(), 0);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found: typeof errors = {};
    if (!password) found.password = tx('Enter your password.');
    if (!understood) found.understood = tx('Please tick the box to confirm.');
    if (Object.keys(found).length) {
      setErrors(found);
      focusFirstMarked(form.current);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await closeMyAccount(password);
      setPassword('');
      setClosed(true);
    } catch (error) {
      const text = textOf(error, tx('Could not close your account. Please try again.'));
      setErrors(text === WRONG_TO_CLOSE ? { password: text } : text === NOT_CONFIRMED ? { understood: text } : { form: text });
      focusFirstMarked(form.current);
    } finally {
      setBusy(false);
    }
  };

  if (closed) {
    return (
      <section aria-labelledby="profile-closed-title" {...cardProps('terra', index, 'pf-account')}>
        <CardHeading
          id="profile-closed-title"
          icon={<UserX size={23} />}
          title={t('Your account is closed')}
          subtitle={t("You were signed out everywhere. Your doctor's clinic decides which medical records it must keep and will tell you.")}
        />
        <h3 ref={heading} tabIndex={-1} className="pf-account-focus">{t('Thank you for using MaternaSync.')}</h3>
        <div className="pf-actions">
          <button type="button" className="btn-primary" onClick={logout}>{t('Go to sign in')}</button>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="profile-close-title" {...cardProps('peach', index, 'pf-account')}>
      <CardHeading
        id="profile-close-title"
        icon={<UserX size={23} />}
        title={t('Close my account')}
        subtitle={t("Closing your account signs you out everywhere, stops anyone you added from seeing your records and ends your WhatsApp permissions. Your doctor's clinic decides which medical records it must keep and will tell you.")}
      />
      <p className="continuity-muted">
        {t('Download your data first. Once your account is closed you cannot sign in to get it.')}{' '}
        <a href="#profile-my-data">{t('Go to Download all my data')}</a>
      </p>
      {!open && (
        <div className="pf-actions">
          <button ref={opener} type="button" className="btn-secondary pf-danger-outline" aria-expanded={false} onClick={() => setOpen(true)}>{t('Close my account…')}</button>
        </div>
      )}
      {open && (
        <form ref={form} noValidate onSubmit={(e) => void submit(e)} aria-label={t('Close my account')} className="pf-close-form">
          <Field label={t('Your password')} error={errors.password && t(errors.password)}>
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <div className="continuity-field">
            <label className="continuity-check">
              <input type="checkbox" checked={understood} aria-invalid={errors.understood ? true : undefined} aria-describedby={errors.understood ? 'close-understood-error' : undefined} onChange={(e) => setUnderstood(e.target.checked)} />
              {t('I understand that I will be signed out everywhere and will not be able to sign in again.')}
            </label>
            {errors.understood && <p id="close-understood-error" className="continuity-field-error">{t(errors.understood)}</p>}
          </div>
          {errors.form && <div role="alert" className="pf-error">{t(errors.form)}</div>}
          <div className="pf-actions">
            <button type="submit" className="pf-danger" disabled={busy}>{busy ? t('Closing…') : t('Close my account')}</button>
            <button type="button" className="btn-secondary" disabled={busy} onClick={cancel}>{t('Cancel')}</button>
          </div>
        </form>
      )}
    </section>
  );
}
