import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { fetchMyProfile, updateMyProfile } from '../../api/patientPortal';
import type { PatientProfile } from '../../api/patientPortal';
import { ApiError } from '../../api/client';
import { Field, inputStyle } from '../../components/auth/AuthField';
import { Link } from 'react-router-dom';
import { tx, useLanguage } from '../../i18n';
import { useTour } from '../../tour/tourContext';
import { LocationCard } from './LocationCard';

const readOnlyInputStyle = { ...inputStyle, background: 'var(--bg-tertiary)', color: 'var(--text-muted)', cursor: 'not-allowed' };

export function ProfilePage() {
  const { t } = useLanguage();
  const tour = useTour();
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
      .catch(() => setError(tx("We couldn't load your profile. Please try again.")))
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
      setError(err instanceof ApiError ? err.message : t('Could not save your profile. Please try again.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main style={{ padding: '24px', flex: 1, maxWidth: '520px', margin: '0 auto', width: '100%' }}>
      <h1 className="page-title" style={{ fontSize: '1.4rem', margin: '0 0 20px 0' }}>{t('Profile')}</h1>

      {isLoading && (
        <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>{t('Loading your profile…')}</div>
      )}

      {!isLoading && profile && (
        <form onSubmit={handleSubmit} className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Field label={t('Full Name')}>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} style={inputStyle} />
          </Field>
          <Field label={t('Email')}>
            <input value={profile.email} disabled style={readOnlyInputStyle} />
          </Field>
          <Field label={t('Date of Birth')}>
            <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} style={inputStyle} />
          </Field>
          <Field label={t('Medical Record Number')}>
            <input value={profile.mrn ?? t('Not yet assigned')} disabled style={readOnlyInputStyle} />
          </Field>
          <Field label={t('Phone')}>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t('Not provided')} style={inputStyle} />
          </Field>

          {error && <div style={{ fontSize: '0.82rem', color: 'var(--rose-urgent)' }}>{t(error)}</div>}

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button type="submit" disabled={isSaving} className="btn-primary">
              {isSaving ? t('Saving…') : t('Save Changes')}
            </button>
            {saved && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.82rem', color: 'var(--emerald-raw)', fontWeight: 600 }}>
                <CheckCircle2 size={15} /> {t('Saved')}
              </span>
            )}
          </div>
        </form>
      )}

      {!isLoading && profile && <LocationCard />}

      {!isLoading && profile && (
        <div className="glass-panel" style={{ padding: '20px 24px', marginTop: '16px' }}>
          <h2 style={{ fontSize: '1rem', margin: '0 0 6px 0' }}>{t('Emergency details')}</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 12px 0' }}>
            {t('Your emergency contact and preferred hospital are kept on the Emergency help page. Only you can see them.')}
          </p>
          <Link className="btn-secondary" to="/patient/emergency">{t('Open Emergency help')}</Link>
        </div>
      )}

      {/* Always offered, so a demonstration account (which never gets the new-account welcome) can show the tour. */}
      {!isLoading && profile && (
        <div className="glass-panel" style={{ padding: '20px 24px', marginTop: '16px' }}>
          <h2 style={{ fontSize: '1rem', margin: '0 0 6px 0' }}>{t('Tour')}</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 12px 0' }}>
            {t('Take the short tour again to see what each part of the app is for.')}
          </p>
          <button type="button" className="btn-secondary" onClick={tour.start}>{t('Start a tour')}</button>
        </div>
      )}
    </main>
  );
}
