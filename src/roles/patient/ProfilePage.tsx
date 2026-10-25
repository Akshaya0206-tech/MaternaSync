import { useEffect, useRef, useState } from 'react';
import { ArrowRight, BadgeCheck, CalendarDays, Check, ClipboardList, Compass, Mail, Phone, ShieldAlert, User, UserRound } from 'lucide-react';
import { fetchMyProfile, updateMyProfile } from '../../api/patientPortal';
import type { PatientProfile } from '../../api/patientPortal';
import { ApiError } from '../../api/client';
import { Link } from 'react-router-dom';
import { tx, useLanguage } from '../../i18n';
import { useTour } from '../../tour/tourContext';
import { LocationCard } from './LocationCard';
import { TrustedPeopleCard } from './TrustedPeopleCard';
import { CardHeading, FieldTile, HeartbeatLine, SavedBadge } from './ProfileArt';
import { cardProps, initialsOf } from './profileCard';
import './profile.css';

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
  const [savedCount, setSavedCount] = useState(0); // a new count plays the "Saved" animation again
  const hideSaved = useRef<number | undefined>(undefined);

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
    return () => window.clearTimeout(hideSaved.current);
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
      setSavedCount((n) => n + 1);
      window.clearTimeout(hideSaved.current);
      hideSaved.current = window.setTimeout(() => setSaved(false), 3500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('Could not save your profile. Please try again.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="pf-page">
      <header className="pf-header" style={cardProps('teal', 0).style}>
        <span className="pf-header-icon" aria-hidden="true"><UserRound size={30} /></span>
        <div>
          <h1 className="page-title">{t('Profile')}</h1>
          <p>{t('Manage your personal and medical details')}</p>
        </div>
      </header>

      {isLoading && <div className="pf-card pf-tone-teal pf-loading" role="status">{t('Loading your profile…')}</div>}

      {!isLoading && !profile && error && <div className="pf-card pf-tone-terra pf-loading" role="alert" style={{ color: 'var(--rose-urgent)' }}>{t(error)}</div>}

      {!isLoading && profile && (
        <form onSubmit={handleSubmit} aria-labelledby="profile-name" {...cardProps('teal', 1)}>
          <div className="pf-hero">
            <div className="pf-avatar" aria-hidden="true">{initialsOf(profile.fullName)}</div>
            <div className="pf-hero-text">
              <h2 id="profile-name" className="pf-hero-name">{profile.fullName}</h2>
              <span className="pf-role"><BadgeCheck size={16} aria-hidden="true" /> {t('Patient')}</span>
            </div>
            <HeartbeatLine />
          </div>

          <div className="pf-fields">
            <FieldTile icon={<User size={20} />} label={t('Full Name')} index={0}>
              <input className="pf-input" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
            </FieldTile>
            <FieldTile icon={<Mail size={20} />} label={t('Email')} index={1}>
              <input className="pf-input" value={profile.email} readOnly aria-readonly="true" />
            </FieldTile>
            <FieldTile icon={<CalendarDays size={20} />} label={t('Date of Birth')} index={2}>
              <input className="pf-input" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} autoComplete="bday" />
            </FieldTile>
            <FieldTile icon={<ClipboardList size={20} />} label={t('Medical Record Number')} index={3}>
              <input className="pf-input" value={profile.mrn ?? t('Not yet assigned')} readOnly aria-readonly="true" />
            </FieldTile>
            <FieldTile icon={<Phone size={20} />} label={t('Phone')} index={4}>
              <input className="pf-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t('Not provided')} inputMode="tel" autoComplete="tel" />
            </FieldTile>
          </div>

          {error && <div className="pf-error" role="alert">{t(error)}</div>}

          <div className="pf-actions">
            <button type="submit" disabled={isSaving} className="btn-primary pf-save">
              {isSaving ? t('Saving…') : <><Check size={17} aria-hidden="true" /> {t('Save Changes')}</>}
            </button>
            {saved && <SavedBadge key={savedCount}>{t('Saved')}</SavedBadge>}
          </div>
        </form>
      )}

      {!isLoading && profile && <LocationCard index={2} />}

      {!isLoading && profile && <TrustedPeopleCard index={3} />}

      {!isLoading && profile && (
        <section aria-labelledby="profile-emergency-title" {...cardProps('terra', 4)}>
          <CardHeading
            id="profile-emergency-title"
            icon={<ShieldAlert size={23} />}
            title={t('Emergency details')}
            subtitle={t('Your emergency contact and preferred hospital are kept on the Emergency help page. Only you can see them.')}
          />
          <Link className="btn-secondary pf-cta" to="/patient/emergency">{t('Open Emergency help')} <ArrowRight size={16} aria-hidden="true" /></Link>
        </section>
      )}

      {/* Always offered, so a demonstration account (which never gets the new-account welcome) can show the tour. */}
      {!isLoading && profile && (
        <section aria-labelledby="profile-tour-title" {...cardProps('navy', 5)}>
          <CardHeading
            id="profile-tour-title"
            icon={<Compass size={23} />}
            title={t('Tour')}
            subtitle={t('Take the short tour again to see what each part of the app is for.')}
          />
          <button type="button" className="btn-secondary pf-cta" onClick={tour.start}>{t('Start a tour')} <ArrowRight size={16} aria-hidden="true" /></button>
        </section>
      )}
    </main>
  );
}
