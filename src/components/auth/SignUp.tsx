import { useEffect, useState } from 'react';
import { AuthLayout } from './AuthLayout';
import { Field, inputStyle } from './AuthField';
import { fetchAuthOptions, register } from '../../api/auth';
import { ApiError } from '../../api/client';
import type { CurrentUser, UserRole } from '../../api/auth';
import { offerTourToNewAccount } from '../../tour/tourContext';
import { AlertCircle, MapPin } from 'lucide-react';

interface SignUpProps {
  /** `landOn` names the page to open first when it is not the usual home page (a patient whose area was not found). */
  onAuthenticated: (token: string, user: CurrentUser, options?: { landOn?: string }) => void;
  onSwitchToSignIn: () => void;
}

// Shown until the server says which roles can sign up. The care-team roles are not in this list: they only appear when the
// server reports that the care-team login is switched on.
const DEFAULT_ROLES: { value: UserRole; label: string }[] = [
  { value: 'patient', label: 'Patient' },
  { value: 'doctor', label: 'Doctor' },
  { value: 'caregiver', label: 'Family member or trusted person' },
];

export const SignUp: React.FC<SignUpProps> = ({ onAuthenticated, onSwitchToSignIn }) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>('doctor');
  const [roles, setRoles] = useState(DEFAULT_ROLES);
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    fetchAuthOptions().then((options) => { if (active && options.signUpRoles.length) setRoles(options.signUpRoles); }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // A patient says where they live (required: it decides which emergency numbers and hospitals they are shown) and may
  // add who to call in an emergency (optional).
  const [area, setArea] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [locating, setLocating] = useState<'idle' | 'asking' | 'denied'>('idle');
  const [contactName, setContactName] = useState('');
  const [contactRelation, setContactRelation] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [hospitalName, setHospitalName] = useState('');
  const [hospitalPhone, setHospitalPhone] = useState('');

  const useMyLocation = () => {
    if (!('geolocation' in navigator)) { setLocating('denied'); return; }
    setLocating('asking');
    navigator.geolocation.getCurrentPosition(
      (p) => { setCoords({ lat: p.coords.latitude, lon: p.coords.longitude }); setLocating('idle'); },
      () => setLocating('denied'),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 },
    );
  };

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
    if (role === 'patient' && !area.trim() && !coords) {
      return 'Please enter your area or city, or use your current location.';
    }
    if (role === 'caregiver' && !inviteCode.trim()) {
      return 'Please enter the invite code she gave you.';
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
      const blank = (text: string) => text.trim() || null;
      // The location goes with the account request, so either both are saved or neither is.
      const emergency = role === 'patient'
        ? {
            homeLabel: blank(area) ?? (coords ? 'My current location' : null), homeLat: coords?.lat ?? null, homeLon: coords?.lon ?? null,
            contactName: blank(contactName), contactRelation: blank(contactRelation), contactPhone: blank(contactPhone),
            hospitalName: blank(hospitalName), hospitalPhone: blank(hospitalPhone),
          }
        : undefined;
      const result = await register({
        fullName: fullName.trim(), email: email.trim(), password, confirmPassword, role, emergency,
        inviteCode: role === 'caregiver' ? inviteCode.trim() : undefined,
      });
      // A brand-new doctor or patient is offered the guided tour on first sign-in.
      if (role === 'doctor' || role === 'patient') offerTourToNewAccount(result.user.id);
      // An area the map could not find is kept as text, but hospitals near it cannot be shown: open the Location card to fix it.
      onAuthenticated(result.accessToken, result.user, result.locationFound === false ? { landOn: '/patient/profile#location' } : undefined);
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
            {roles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </Field>

        {role === 'caregiver' && (
          <fieldset style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px', margin: 0 }}>
            <legend style={{ padding: '0 6px', fontSize: '0.85rem', fontWeight: 700 }}>Invite code (required)</legend>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              A family member or friend joins only when the woman invites them. Ask her to open Profile, then Trusted people, and
              make an invite. She will see a code like ABCD-2345 that works once and expires after 48 hours. She chooses what you can see.
            </p>
            <Field label="Invite code">
              <input type="text" required value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} style={inputStyle} placeholder="ABCD-2345" />
            </Field>
          </fieldset>
        )}

        {role === 'patient' && (
          <>
          <fieldset style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px', margin: 0 }}>
            <legend style={{ padding: '0 6px', fontSize: '0.85rem', fontWeight: 700 }}>Where you live (required)</legend>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              MaternaSync uses this to show the right emergency numbers and the hospitals nearest to you, and to notice when you are
              away from home. Only you can see it, it is not sent to your doctors, and you can change it any time under Profile.
            </p>
            <Field label="Your area or city">
              <input type="text" required={!coords} value={area} onChange={(e) => { setArea(e.target.value); setCoords(null); }} autoComplete="address-level2" style={inputStyle} placeholder="For example Thandalam, Chennai" />
            </Field>
            <div>
              <button type="button" className="btn-secondary" onClick={useMyLocation} disabled={locating === 'asking'} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <MapPin size={15} aria-hidden="true" /> {locating === 'asking' ? 'Finding your location…' : coords ? 'Location found. Use again' : 'Use my current location'}
              </button>
              {locating === 'denied' && <span role="alert" style={{ marginLeft: '10px', fontSize: '0.78rem', color: 'var(--rose-urgent)' }}>Location is off for this site. Type your area instead.</span>}
              {coords && <span role="status" style={{ marginLeft: '10px', fontSize: '0.78rem', color: 'var(--emerald-raw)' }}>Your location will be saved.</span>}
            </div>
          </fieldset>
          <fieldset style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px', margin: 0 }}>
            <legend style={{ padding: '0 6px', fontSize: '0.85rem', fontWeight: 700 }}>Help in an emergency (optional)</legend>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Who to call and which hospital you prefer. You can skip this and add it later under Emergency help.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Field label="Emergency contact name"><input type="text" value={contactName} onChange={(e) => setContactName(e.target.value)} style={inputStyle} /></Field>
              <Field label="Relationship"><input type="text" value={contactRelation} onChange={(e) => setContactRelation(e.target.value)} style={inputStyle} placeholder="For example husband" /></Field>
            </div>
            <Field label="Emergency contact phone"><input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} autoComplete="tel" style={inputStyle} placeholder="+91" /></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Field label="Hospital you usually go to"><input type="text" value={hospitalName} onChange={(e) => setHospitalName(e.target.value)} style={inputStyle} /></Field>
              <Field label="That hospital's phone"><input type="tel" value={hospitalPhone} onChange={(e) => setHospitalPhone(e.target.value)} style={inputStyle} /></Field>
            </div>
          </fieldset>
          </>
        )}

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
