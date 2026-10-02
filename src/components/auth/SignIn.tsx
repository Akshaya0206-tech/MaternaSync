import { useState } from 'react';
import { AuthLayout } from './AuthLayout';
import { Field, inputStyle } from './AuthField';
import { login } from '../../api/auth';
import { ApiError } from '../../api/client';
import type { CurrentUser } from '../../api/auth';
import { AlertCircle } from 'lucide-react';

interface SignInProps {
  onAuthenticated: (token: string, user: CurrentUser) => void;
  onSwitchToSignUp: () => void;
}

export const SignIn: React.FC<SignInProps> = ({ onAuthenticated, onSwitchToSignUp }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await login(email.trim(), password);
      onAuthenticated(result.accessToken, result.user);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Invalid email or password.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <h1 className="page-title" style={{ fontSize: '1.4rem', margin: '0 0 4px 0', textAlign: 'center' }}>Welcome back</h1>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center', margin: '0 0 24px 0' }}>
        Sign in to your MaternaSync workspace
      </p>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--rose-urgent-bg)', color: 'var(--rose-urgent)', border: '1px solid rgba(156, 58, 34, 0.3)', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: '0.825rem', marginBottom: '16px' }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <Field label="Email">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            style={inputStyle}
          />
        </Field>
        <Field label="Password">
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
            Forgot password?
          </button>
        </div>

        <button type="submit" className="btn-primary" disabled={isSubmitting} style={{ width: '100%', padding: '11px', fontSize: '0.9rem', marginTop: '4px' }}>
          {isSubmitting ? 'Signing in…' : 'Sign In'}
        </button>
      </form>

      <p style={{ textAlign: 'center', fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: '20px' }}>
        Don't have an account?{' '}
        <button onClick={onSwitchToSignUp} style={{ background: 'none', border: 'none', color: 'var(--teal-primary)', fontWeight: 700, cursor: 'pointer', fontSize: '0.825rem' }}>
          Create Account
        </button>
      </p>
    </AuthLayout>
  );
};
