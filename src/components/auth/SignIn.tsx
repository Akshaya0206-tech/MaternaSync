import { useEffect, useState } from 'react';
import { AuthLayout } from './AuthLayout';
import { Field, inputStyle } from './AuthField';
import { fetchAuthOptions, fetchDemoAccounts, login } from '../../api/auth';
import type { DemoAccount as PortalDemoAccount } from '../../api/auth';
import { ApiError } from '../../api/client';
import type { CurrentUser } from '../../api/auth';
import { AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { tx, useLanguage } from '../../i18n';

interface SignInProps {
  onAuthenticated: (token: string, user: CurrentUser) => void;
  onSwitchToSignUp: () => void;
}

interface DemoAccount {
  role: 'Patient' | 'Caregiver' | 'Care Team' | 'Doctor';
  name: string;
  email: string;
  password: string;
}

// Synthetic demo/development credentials only — no real patient data.
// Visible here deliberately: this is a hackathon/demo application.
const DEMO_ACCOUNTS: DemoAccount[] = [
  { role: 'Patient', name: 'Sarah Jenkins', email: 'sarah.jenkins@maternasync.app', password: 'SarahDemo123!' },
  { role: 'Patient', name: 'Priya Sharma', email: 'priya.sharma@maternasync.app', password: 'PriyaDemo123!' },
  { role: 'Patient', name: 'Ananya Kumar', email: 'ananya.kumar@maternasync.app', password: 'AnanyaDemo123!' },
  { role: 'Patient', name: 'Meera Raj', email: 'meera.raj@maternasync.app', password: 'MeeraDemo123!' },
  { role: 'Caregiver', name: 'Ravi Jenkins (Sarah\'s husband)', email: 'ravi.jenkins@maternasync.app', password: 'RaviDemo123!' },
  // The care-team accounts still exist; they are only listed (and only accepted) while that login is switched on.
  { role: 'Care Team', name: 'Brenda Miller', email: 'brenda.miller@maternasync.app', password: 'BrendaDemo123!' },
  { role: 'Care Team', name: 'James Wilson', email: 'james.wilson@maternasync.app', password: 'JamesDemo123!' },
  { role: 'Care Team', name: 'Kavya Narayanan', email: 'kavya.narayanan@maternasync.app', password: 'KavyaDemo123!' },
  { role: 'Doctor', name: 'Dr. Eleanor Vance (Demo Doctor)', email: 'demo@maternasync.app', password: 'MaternaDemo123!' },
  { role: 'Doctor', name: 'Dr. Eleanor Vance', email: 'eleanor.vance@maternasync.app', password: 'EleanorDemo123!' },
  { role: 'Doctor', name: 'Dr. Arjun Menon', email: 'arjun.menon@maternasync.app', password: 'ArjunDemo123!' },
];

const DEMO_ROLE_ORDER: DemoAccount['role'][] = ['Patient', 'Caregiver', 'Care Team', 'Doctor'];

export const SignIn: React.FC<SignInProps> = ({ onAuthenticated, onSwitchToSignUp }) => {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [demoAccounts, setDemoAccounts] = useState<PortalDemoAccount[]>([]);
  const [demoError, setDemoError] = useState('');
  const [demoRole, setDemoRole] = useState('');
  // Until the server says the care-team login is on, its demo accounts are hidden (they would only be refused).
  const [careTeamOn, setCareTeamOn] = useState(false);
  useEffect(() => { let active = true; fetchAuthOptions().then(o => { if (active) setCareTeamOn(o.careTeamEnabled); }).catch(() => undefined); return () => { active = false; }; }, []);
  useEffect(() => { let active = true; fetchDemoAccounts().then(accounts => { if (active) setDemoAccounts(accounts); }).catch(() => { if (active) setDemoError(tx('Demo logins are unavailable. Check that the API is running.')); }); return () => { active = false; }; }, []);
  const signInDemo = async (account: PortalDemoAccount) => {
    if (isSubmitting) return;
    setEmail(account.email); setPassword(account.password); setDemoRole(account.role); setIsSubmitting(true); setError(null);
    try { const result = await login(account.email, account.password); onAuthenticated(result.accessToken, result.user); }
    catch (err) { setError(err instanceof ApiError ? err.message : tx('Could not reach the API. Start the backend and try again.')); }
    finally { setIsSubmitting(false); setDemoRole(''); }
  };
  const [showDemoAccounts, setShowDemoAccounts] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await login(email.trim(), password);
      onAuthenticated(result.accessToken, result.user);
    } catch (err) {
      if (err instanceof ApiError) {
        // A 403 carries a plain explanation from the server (for example, that the care-team sign-in is switched off).
        setError(err.status === 401 ? tx('Invalid email or password.') : err.status === 403 ? err.message : tx('Something went wrong. Please try again.'));
      } else {
        // fetch() itself failed before any response came back — e.g. the
        // backend isn't running/reachable. Not an ApiError, so it needs its
        // own message instead of being shown as a wrong-password failure.
        console.error('Login request failed before reaching the server:', err);
        setError(tx("Can't reach the server right now. Please try again in a moment."));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUseDemoAccount = (account: DemoAccount) => {
    setEmail(account.email);
    setPassword(account.password);
    setError(null);
  };

  return (
    <AuthLayout>
      <h1 className="page-title" style={{ fontSize: '1.4rem', margin: '0 0 4px 0', textAlign: 'center' }}>{t('Welcome back')}</h1>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center', margin: '0 0 24px 0' }}>
        {t('Sign in to your MaternaSync workspace')}
      </p>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--rose-urgent-bg)', color: 'var(--rose-urgent)', border: '1px solid rgba(156, 58, 34, 0.3)', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: '0.825rem', marginBottom: '16px' }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          {t(error)}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <Field label={t('Email')}>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            style={inputStyle}
          />
        </Field>
        <Field label={t('Password')}>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            style={inputStyle}
          />
        </Field>

        <div style={{ textAlign: 'right' }}>
          <button type="button" style={{ background: 'none', border: 'none', color: 'var(--teal-primary)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
            {t('Forgot password?')}
          </button>
        </div>

        <button type="submit" className="btn-primary" disabled={isSubmitting} style={{ width: '100%', padding: '11px', fontSize: '0.9rem', marginTop: '4px' }}>
          {isSubmitting ? t('Signing in…') : t('Sign In')}
        </button>
      </form>

      {demoAccounts.length > 0 && <section aria-label="Demo logins" style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--border-color)' }}>
        <h2 style={{ fontSize: '.95rem', margin: '0 0 6px' }}>{t('Explore a demo workspace')}</h2>
        <p style={{ fontSize: '.77rem', color: 'var(--text-secondary)', margin: '0 0 12px' }}>{t('One-click sign-in with synthetic patient data.')}</p>
        <div style={{ display: 'grid', gap: 8 }}>{demoAccounts.map(account => <button type="button" key={account.role} className="btn-secondary" disabled={isSubmitting} onClick={() => void signInDemo(account)} style={{ justifyContent: 'space-between', width: '100%', padding: '11px 13px' }}><span>{demoRole === account.role ? t('Signing in…') : t('Demo {role}', { role: t(account.label) })}</span><span style={{ fontSize: '.72rem', fontWeight: 400 }}>{account.name}</span></button>)}</div>
        <details style={{ fontSize: '.74rem', color: 'var(--text-secondary)', marginTop: 12 }}><summary style={{ cursor: 'pointer' }}>{t('View demo credentials')}</summary>{demoAccounts.map(account => <p key={account.role} style={{ overflowWrap: 'anywhere' }}><strong>{t(account.label)}</strong><br />{account.email}<br />{account.password}</p>)}</details>
      </section>}
      {demoError && <p role="status" style={{ fontSize: '.8rem', color: 'var(--text-secondary)' }}>{t(demoError)}</p>}

      <p style={{ textAlign: 'center', fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: '20px' }}>
        {t("Don't have an account?")}{' '}
        <button onClick={onSwitchToSignUp} style={{ background: 'none', border: 'none', color: 'var(--teal-primary)', fontWeight: 700, cursor: 'pointer', fontSize: '0.825rem' }}>
          {t('Create Account')}
        </button>
      </p>

      {demoAccounts.length > 0 && <div style={{ marginTop: '18px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
        <button
          type="button"
          onClick={() => setShowDemoAccounts((v) => !v)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', padding: '4px' }}
        >
          {t('Demo Accounts')} {showDemoAccounts ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {showDemoAccounts && (
          <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {DEMO_ROLE_ORDER.filter((role) => role !== 'Care Team' || careTeamOn).map((role) => (
              <div key={role}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '6px' }}>
                  {t(role)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {DEMO_ACCOUNTS.filter((a) => a.role === role).map((account) => (
                    <div
                      key={account.email}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '8px 10px' }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>{account.name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{account.email}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUseDemoAccount(account)}
                        className="btn-secondary"
                        style={{ flexShrink: 0, fontSize: '0.72rem', padding: '6px 10px', whiteSpace: 'nowrap' }}
                      >
                        {t('Use Demo Account')}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>
              {t('Synthetic demo data only. Selecting an account fills the form above — click Sign In to continue.')}
            </p>
          </div>
        )}
      </div>}
    </AuthLayout>
  );
};
