import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { fetchMyProfile, updateMyProfile } from '../../api/patientPortal';
import type { PatientProfile } from '../../api/patientPortal';
import { ApiError } from '../../api/client';
import { Field, inputStyle } from '../../components/auth/AuthField';

const readOnlyInputStyle = { ...inputStyle, background: 'var(--bg-tertiary)', color: 'var(--text-muted)', cursor: 'not-allowed' };

export function ProfilePage() {
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchMyProfile()
      .then((p) => {
        setProfile(p);
        setFullName(p.fullName);
        setPhone(p.phone ?? '');
        setDateOfBirth(p.dateOfBirth ?? '');
      })
      .catch(() => setError("We couldn't load your profile. Please try again."))
      .finally(() => setIsLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await updateMyProfile({ fullName, phone, dateOfBirth });
      setProfile(updated);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main style={{ padding: '24px', flex: 1, maxWidth: '520px', margin: '0 auto', width: '100%' }}>
      <h1 className="page-title" style={{ fontSize: '1.4rem', margin: '0 0 20px 0' }}>Profile</h1>

      {isLoading && (
        <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading your profile…</div>
      )}

      {!isLoading && profile && (
        <form onSubmit={handleSubmit} className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Field label="Full Name">
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Email">
            <input value={profile.email} disabled style={readOnlyInputStyle} />
          </Field>
          <Field label="Date of Birth">
            <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Medical Record Number">
            <input value={profile.mrn ?? 'Not yet assigned'} disabled style={readOnlyInputStyle} />
          </Field>
          <Field label="Phone">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Not provided" style={inputStyle} />
          </Field>

          {error && <div style={{ fontSize: '0.82rem', color: 'var(--rose-urgent)' }}>{error}</div>}

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button type="submit" disabled={isSaving} className="btn-primary">
              {isSaving ? 'Saving…' : 'Save Changes'}
            </button>
            {saved && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.82rem', color: 'var(--emerald-raw)', fontWeight: 600 }}>
                <CheckCircle2 size={15} /> Saved
              </span>
            )}
          </div>
        </form>
      )}
    </main>
  );
}
