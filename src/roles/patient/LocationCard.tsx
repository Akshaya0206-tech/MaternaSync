import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MapPin, MapPinCheck, Navigation } from 'lucide-react';
import { getEmergency, saveEmergency } from '../../api/emergency';
import type { EmergencyProfile } from '../../api/emergency';
import { ApiError } from '../../api/client';
import { tx, useLanguage } from '../../i18n';
import { usePatientLocation } from './locationContext';
import { CardHeading, FieldTile, LocationArt, Radar, Skyline, SuccessCheck, Confetti } from './ProfileArt';
import { cardProps } from './profileCard';

/** The place the patient lives, collected when the account is made. It decides which hospitals and numbers Emergency
 *  help shows, and what "away from home" is measured against. Only the patient sees it. */
export function LocationCard({ index = 2 }: { index?: number }) {
  const { t } = useLanguage();
  const where = usePatientLocation();
  const [profile, setProfile] = useState<EmergencyProfile | null>(null);
  const [area, setArea] = useState('');
  const [point, setPoint] = useState<{ lat: number; lon: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [messageCount, setMessageCount] = useState(0); // a new count plays the saved animation again
  const asking = where.status === 'asking';
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
      else {
        setMessage(tx('Location saved.'));
        setMessageCount((n) => n + 1);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tx('Could not save your location. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  // A saved area with no position behind it: Emergency help cannot show hospitals near it or notice that the patient is away.
  const notFound = Boolean(profile?.homeLabel && !profile.hasHome);

  return (
    <form ref={card} id="location" onSubmit={save} aria-labelledby="profile-location-title" {...cardProps('sage', index, 'pf-location')}>
      <LocationArt locating={asking} found={point !== null && !asking} />
      <CardHeading
        id="profile-location-title"
        icon={<MapPin size={23} />}
        title={t('Location')}
        subtitle={t('Where you live. Emergency help uses it to show the right numbers and the hospitals nearest to you, and to notice when you are away from it. Only you can see it.')}
      />
      {profile && (
        <p role="status" className="pf-saved-strip" data-testid="saved-location">
          <span className="pf-strip-icon" aria-hidden="true">{profile.hasHome ? <MapPinCheck size={18} /> : <MapPin size={18} />}</span>
          <span className="pf-strip-text">
            {profile.hasHome
              ? t('Saved: {place}', { place: profile.homeLabel ?? '' })
              : profile.homeLabel
                ? t('Saved as text, but not found on the map: {place}', { place: profile.homeLabel })
                : t('No location saved yet.')}
          </span>
          <Skyline />
        </p>
      )}
      <FieldTile icon={<MapPin size={20} />} label={t('Your area or city')}>
        <input
          className="pf-input"
          ref={areaInput}
          maxLength={200}
          value={area}
          autoComplete="address-level2"
          placeholder={t('For example Thandalam, Chennai')}
          onChange={(e) => { setArea(e.target.value); setPoint(null); }}
        />
      </FieldTile>
      {notFound && !error && (
        <div role="alert" className="pf-error">
          {t('We could not find that area on the map. Try a nearby town, or use your current location.')}
        </div>
      )}
      {error && <div role="alert" className="pf-error">{t(error)}</div>}
      <div className="pf-locate-row">
        <button type="submit" className="btn-primary" disabled={busy || !profile}>{busy ? t('Saving…') : t('Save location')}</button>
        <button type="button" className="btn-secondary" disabled={asking} onClick={() => void fillFromDevice()}>
          <Navigation size={16} aria-hidden="true" /> {asking ? t('Finding your location…') : point ? t('Location found. Save to keep it.') : t('Use my current location')}
        </button>
        {message && <span key={messageCount} role="status" className="pf-success"><Confetti /><SuccessCheck />{t(message)}</span>}
      </div>
      {(asking || point) && (
        <div className={`pf-locate-status${asking ? ' pf-locating' : ''}`}>
          {asking ? <Radar label={t('Finding your location…')} /> : <span role="status" className="pf-success"><SuccessCheck />{t('Location detected!')}</span>}
        </div>
      )}
    </form>
  );
}
