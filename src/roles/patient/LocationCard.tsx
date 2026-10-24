import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { getEmergency, saveEmergency } from '../../api/emergency';
import type { EmergencyProfile } from '../../api/emergency';
import { ApiError } from '../../api/client';
import { Field, inputStyle } from '../../components/auth/AuthField';
import { tx, useLanguage } from '../../i18n';
import { usePatientLocation } from './locationContext';

/** The place the patient lives, collected when the account is made. It decides which hospitals and numbers Emergency
 *  help shows, and what "away from home" is measured against. Only the patient sees it. */
export function LocationCard() {
  const { t } = useLanguage();
  const where = usePatientLocation();
  const [profile, setProfile] = useState<EmergencyProfile | null>(null);
  const [area, setArea] = useState('');
  const [point, setPoint] = useState<{ lat: number; lon: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const card = useRef<HTMLFormElement>(null);
  const areaInput = useRef<HTMLInputElement>(null);
  const { hash } = useLocation();

  // Sign-up opens this card (/patient/profile#location) when the area typed there could not be found on the map.
  useEffect(() => {
    if (hash !== '#location' || !profile) return;
    card.current?.scrollIntoView?.({ block: 'center' });
    areaInput.current?.focus();
  }, [hash, profile]);

  useEffect(() => {
    let active = true;
    getEmergency()
      .then((overview) => {
        if (!active) return;
        setProfile(overview.profile);
        setArea(overview.profile.homeLabel ?? '');
      })
      .catch(() => { if (active) setError(tx("We couldn't load your saved location. Please try again.")); });
    return () => { active = false; };
  }, []);

  const fillFromDevice = async () => {
    setError('');
    setMessage('');
    const found = await where.locate();
    if (!found) {
      setError(tx('Location is off for this site. Type your area instead.'));
      return;
    }
    setPoint({ lat: found.lat, lon: found.lon });
    if (!area.trim()) setArea(t('My current location'));
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile) return;
    const label = area.trim();
    if (!label && !point) {
      setError(tx('Enter your area or city, or use your current location.'));
      return;
    }
    // A label that has not been edited keeps the position it already has; a typed one is looked up by the server.
    const keep = !point && label === (profile.homeLabel ?? '') && profile.hasHome ? { lat: profile.homeLat, lon: profile.homeLon } : null;
    const position = point ?? keep;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const saved = await saveEmergency({
        homeLabel: label || null,
        homeLat: position?.lat ?? null,
        homeLon: position?.lon ?? null,
        contactName: profile.contactName,
        contactRelation: profile.contactRelation,
        contactPhone: profile.contactPhone,
        hospitalName: profile.hospitalName,
        hospitalPhone: profile.hospitalPhone,
        hospitalAddress: profile.hospitalAddress,
        liveLocation: where.tracking,
      });
      setProfile(saved.profile);
      setArea(saved.profile.homeLabel ?? '');
      setPoint(null);
      where.setHome(saved.profile);
      if (saved.located === false) setError(tx('We could not find that area on the map. Try a nearby town, or use your current location.'));
      else setMessage(tx('Location saved.'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tx('Could not save your location. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  // A saved area with no position behind it: Emergency help cannot show hospitals near it or notice that the patient is away.
  const notFound = Boolean(profile?.homeLabel && !profile.hasHome);

  return (
    <form ref={card} id="location" onSubmit={save} className="glass-panel" aria-labelledby="profile-location-title" style={{ padding: '20px 24px', marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <h2 id="profile-location-title" style={{ fontSize: '1rem', margin: 0 }}>{t('Location')}</h2>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
        {t('Where you live. Emergency help uses it to show the right numbers and the hospitals nearest to you, and to notice when you are away from it. Only you can see it.')}
      </p>
      {profile && (
        <p role="status" style={{ fontSize: '0.85rem', margin: 0, fontWeight: 600 }} data-testid="saved-location">
          {profile.hasHome
            ? t('Saved: {place}', { place: profile.homeLabel ?? '' })
            : profile.homeLabel
              ? t('Saved as text, but not found on the map: {place}', { place: profile.homeLabel })
              : t('No location saved yet.')}
        </p>
      )}
      <Field label={t('Your area or city')}>
        <input
          ref={areaInput}
          maxLength={200}
          value={area}
          autoComplete="address-level2"
          placeholder={t('For example Thandalam, Chennai')}
          onChange={(e) => { setArea(e.target.value); setPoint(null); }}
          style={inputStyle}
        />
      </Field>
      {notFound && !error && (
        <div role="alert" style={{ fontSize: '0.82rem', color: 'var(--rose-urgent)' }}>
          {t('We could not find that area on the map. Try a nearby town, or use your current location.')}
        </div>
      )}
      {error && <div role="alert" style={{ fontSize: '0.82rem', color: 'var(--rose-urgent)' }}>{t(error)}</div>}
      {message && <div role="status" style={{ fontSize: '0.82rem', color: 'var(--emerald-raw)', fontWeight: 600 }}>{t(message)}</div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
        <button type="submit" className="btn-primary" disabled={busy || !profile}>{busy ? t('Saving…') : t('Save location')}</button>
        <button type="button" className="btn-secondary" disabled={where.status === 'asking'} onClick={() => void fillFromDevice()} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <MapPin size={15} aria-hidden="true" /> {where.status === 'asking' ? t('Finding your location…') : point ? t('Location found. Save to keep it.') : t('Use my current location')}
        </button>
      </div>
    </form>
  );
}
