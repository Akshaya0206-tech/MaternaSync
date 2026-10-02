import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { fetchProfile, updateProfile } from '../../api/careTeamPortal';
import type { CareTeamProfile } from '../../api/careTeamPortal';
import { ApiError } from '../../api/client';
import { Field, inputStyle } from '../../components/auth/AuthField';

const readOnlyInputStyle = { ...inputStyle, background: 'var(--bg-tertiary)', color: 'var(--text-muted)', cursor: 'not-allowed' };

export function ProfilePage() {
  const [profile, setProfile] = useState<CareTeamProfile | null>(null);
  const [fullName, setFullName] = useState('');
  const [title, setTitle] = useState('');
  const [facility, setFacility] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchProfile()
      .then((p) => { setProfile(p); setFullName(p.fullName); setTitle(p.title ?? ''); setFacility(p.facility ?? ''); })
      .catch(() => setError("We couldn't load your profile. Please try again."))
      .finally(() => setIsLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await updateProfile({ fullName, title, facility });
      setProfile(updated);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your profile.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main style={{ padding: '24px', flex: 1, maxWidth: '520px', margin: '0 auto', width: '100%' }}>
      <h1 className="page-title" style={{ fontSize: '1.4rem', margin: '0 0 20px 0' }}>Profile</h1>

      {isLoading && <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>}

      {!isLoading && profile && (
        <form onSubmit={handleSubmit} className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Field label="Full Name"><input value={fullName} onChange={(e) => setFullName(e.target.value)} style={inputStyle} /></Field>
          <Field label="Email"><input value={profile.email} disabled style={readOnlyInputStyle} /></Field>
          <Field label="Role"><input value="Care Team" disabled style={readOnlyInputStyle} /></Field>
          <Field label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Obstetric Triage Nurse" style={inputStyle} /></Field>
          <Field label="Facility"><input value={facility} onChange={(e) => setFacility(e.target.value)} placeholder="Not provided" style={inputStyle} /></Field>

          {error && <div style={{ fontSize: '0.82rem', color: 'var(--rose-urgent)' }}>{error}</div>}

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button type="submit" disabled={isSaving} className="btn-primary">{isSaving ? 'Saving…' : 'Save Changes'}</button>
            {saved && <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.82rem', color: 'var(--emerald-raw)', fontWeight: 600 }}><CheckCircle2 size={15} /> Saved</span>}
          </div>
        </form>
      )}
    </main>
  );
}
