import { useState } from 'react';
import { AuthLayout } from './AuthLayout';
import { Field, inputStyle } from './AuthField';
import { register } from '../../api/auth';
import { ApiError } from '../../api/client';
import type { CurrentUser, UserRole } from '../../api/auth';
import { AlertCircle } from 'lucide-react';

interface SignUpProps {
  onAuthenticated: (token: string, user: CurrentUser) => void;
  onSwitchToSignIn: () => void;
}

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'doctor', label: 'Doctor' },
  { value: 'nurse', label: 'Nurse' },
  { value: 'care_coordinator', label: 'Care Coordinator' },
  { value: 'other', label: 'Other Care Team Member' },
];

export const SignUp: React.FC<SignUpProps> = ({ onAuthenticated, onSwitchToSignIn }) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>('doctor');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = (): string | null => {
    if (!fullName.trim() || !email.trim() || !password || !confirmPassword) {
      return 'Please complete all required fields.';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return 'Please enter a valid email address.';
    }
    if (password.length < 8) {
      return 'Password must be at least 8 characters.';
    }
    if (password !== confirmPassword) {
      return 'Password and Confirm Password must match.';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await register({ fullName: fullName.trim(), email: email.trim(), password, confirmPassword, role });
      onAuthenticated(result.accessToken, result.user);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <h1 className="page-title" style={{ fontSize: '1.4rem', margin: '0 0 4px 0', textAlign: 'center' }}>Create your MaternaSync account</h1>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center', margin: '0 0 24px 0' }}>
        Join your care team's workspace
      </p>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--rose-urgent-bg)', color: 'var(--rose-urgent)', border: '1px solid rgba(156, 58, 34, 0.3)', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: '0.825rem', marginBottom: '16px' }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <Field label="Full Name">
          <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" style={inputStyle} />
        </Field>
        <Field label="Email">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" style={inputStyle} />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Field label="Password">
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" style={inputStyle} />
          </Field>
          <Field label="Confirm Password">
            <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" style={inputStyle} />
          </Field>
        </div>
        <Field label="Role">
          <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} style={{ ...inputStyle, cursor: 'pointer' }}>
            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </Field>

        <button type="submit" className="btn-primary" disabled={isSubmitting} style={{ width: '100%', padding: '11px', fontSize: '0.9rem', marginTop: '4px' }}>
          {isSubmitting ? 'Creating account…' : 'Create Account'}
        </button>
      </form>

      <p style={{ textAlign: 'center', fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: '20px' }}>
        Already have an account?{' '}
        <button onClick={onSwitchToSignIn} style={{ background: 'none', border: 'none', color: 'var(--teal-primary)', fontWeight: 700, cursor: 'pointer', fontSize: '0.825rem' }}>
          Sign In
        </button>
      </p>
    </AuthLayout>
  );
};
