import { useCallback, useEffect, useRef, useState } from 'react';
import { PhoneCall, MapPin, Hospital as HospitalIcon, UserRound, IdCard } from 'lucide-react';
import { getEmergency, getNearbyHospitals, saveEmergency } from '../../api/emergency';
import type { EmergencyNumber, EmergencyOverview, EmergencyProfile, NearbyHospitals } from '../../api/emergency';
import { useAuth } from '../../auth/AuthContext';
import { useOnline } from '../../offline/useOnline';
import { tx, useLanguage } from '../../i18n';
import { Badge, Empty, Feedback, Field, Page, Panel, useAction } from '../../components/continuity/shared';
import { usePatientLocation } from './locationContext';
import { BUILT_IN_OVERVIEW, keepEmergency, keptEmergency } from './emergencyCache';
import { HospitalCard } from './HospitalCard';

const dial = (number: string) => `tel:${number.replace(/[^\d+]/g, '')}`;
const mapsSearch = (lat?: number, lon?: number) =>
  lat !== undefined && lon !== undefined ? `https://www.google.com/maps/search/hospital/@${lat},${lon},14z` : 'https://www.google.com/maps/search/hospitals+near+me';
// A hospital the clinic listed has an address but no position, so the map is asked for it by name.
const mapsPlace = (name: string, address: string | null) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([name, address].filter(Boolean).join(', '))}`;

interface Form {
  homeLabel: string;
  homeLat: number | null;
  homeLon: number | null;
  contactName: string;
  contactRelation: string;
  contactPhone: string;
  hospitalName: string;
  hospitalPhone: string;
  hospitalAddress: string;
  mcpNumber: string;
}

const toForm = (p: EmergencyProfile): Form => ({
  homeLabel: p.homeLabel ?? '', homeLat: p.homeLat, homeLon: p.homeLon,
  contactName: p.contactName ?? '', contactRelation: p.contactRelation ?? '', contactPhone: p.contactPhone ?? '',
  hospitalName: p.hospitalName ?? '', hospitalPhone: p.hospitalPhone ?? '', hospitalAddress: p.hospitalAddress ?? '',
  mcpNumber: p.mcpNumber ?? '',
});

/** Where what is on the page came from: the server just now, the copy kept on this phone, or the numbers built into the app. */
type Source = 'live' | 'phone' | 'built-in';

export function EmergencyPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const online = useOnline();
  const where = usePatientLocation();
  const action = useAction();
  const [overview, setOverview] = useState<EmergencyOverview | null>(null);
  const [from, setFrom] = useState<Source>('live');
  const [nearby, setNearby] = useState<NearbyHospitals | null>(null);
  const [loadingHospitals, setLoadingHospitals] = useState(false);
  const [form, setForm] = useState<Form | null>(null);
  const [cardOpen, setCardOpen] = useState(false);
  const details = useRef<HTMLDetailsElement>(null);
  const fetched = useRef('');
  const cardButton = useRef<HTMLButtonElement>(null);

  // The numbers must show whatever happens: the server's page when it answers, otherwise the copy kept on this phone, otherwise the built-in numbers.
  const load = useCallback(() => {
    let active = true;
    getEmergency()
      .then((o) => {
        if (!active) return;
        keepEmergency(userId, o);
        setOverview(o);
        setFrom('live');
        setForm(toForm(o.profile));
        where.setHome(o.profile);
      })
      .catch(() => {
        if (!active) return;
        const kept = keptEmergency(userId);
        if (kept) {
          setOverview(kept);
          setFrom('phone');
          setForm(toForm(kept.profile));
          where.setHome(kept.profile);
        } else {
          setOverview((old) => old ?? BUILT_IN_OVERVIEW);
          setFrom((old) => (old === 'live' ? 'built-in' : old));
        }
      });
    return () => { active = false; };
    // The provider's setter does not change; this runs once per visit to the page and again when the phone comes back online.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => load(), [load]);
  useEffect(() => {
    if (online && from !== 'live') return load();
  }, [online, from, load]);

  const profile = overview?.profile;
  const clinic = overview?.clinic;
  // The current position wins when there is one; otherwise the server uses the saved home.
  const point = where.position ? { lat: Math.round(where.position.lat * 100) / 100, lon: Math.round(where.position.lon * 100) / 100 } : null;
  const source = point ? `${point.lat},${point.lon}` : profile?.hasHome ? `home:${profile.homeLat},${profile.homeLon}` : '';
  useEffect(() => {
    if (!overview || from !== 'live' || !source || fetched.current === source) return;
    fetched.current = source;
    let active = true;
    setLoadingHospitals(true);
    getNearbyHospitals(where.position ? { lat: where.position.lat, lon: where.position.lon } : null)
      .then((n) => { if (active) setNearby(n); })
      .catch(() => { if (active) setNearby({ needsLocation: false, usedPosition: null, awayKm: null, away: false, hospitals: [], error: 'unreachable', region: null, numbers: [], note: '' }); })
      .finally(() => { if (active) setLoadingHospitals(false); });
    return () => { active = false; };
    // `source` captures everything the request depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overview, source, from]);

  const numbers: EmergencyNumber[] = nearby?.numbers.length ? nearby.numbers : overview?.numbers ?? [];
  const note = nearby?.note || overview?.note || '';
  const set = (key: keyof Form, value: string | number | null) => setForm((old) => (old ? { ...old, [key]: value } : old));
  const usingCurrent = Boolean(where.position);

  const setHomeHere = async () => {
    const found = await where.locate();
    if (found && form) setForm({ ...form, homeLat: found.lat, homeLon: found.lon, homeLabel: form.homeLabel || tx('My current location') });
  };

  return (
    <Page title={t('Emergency help')} subtitle={t('If you or your baby are in danger, call now. Nothing on this page alerts your care team or sends a message.')}>
      <Feedback error={action.error} message={action.message} />
      {from === 'phone' && (
        <div className="continuity-note" role="status">
          {t('Showing the numbers saved on this phone. They are updated when you are back online.')}
        </div>
      )}
      {from === 'built-in' && (
        <div className="continuity-note" role="status">
          {t('Showing the standard numbers for India built into this app. Your own details appear when you are back online.')}
        </div>
      )}
      {where.away && (
        <div className="continuity-note" role="status">
          {t('You seem to be about {km} km from your saved location, so these hospitals are near where you are now.', { km: Math.round(where.awayKm ?? 0) })}
        </div>
      )}

      <Panel title={t('Call now')} aside={<PhoneCall size={18} aria-hidden="true" />}>
        <p className="continuity-muted">{t('Tap a number to call. If nothing happens, dial it on your phone.')}</p>
        <div className="emergency-numbers">
          {numbers.map((n) => (
            <a key={n.number} className={`emergency-call emergency-${n.kind}`} href={dial(n.number)}>
              <strong>{n.number}</strong>
              <span>{t(n.label)}</span>
            </a>
          ))}
        </div>
        {note && <p className="continuity-muted">{t(note)}</p>}
        {from !== 'built-in' && (
        <div className="emergency-people">
          <div className="continuity-note">
            <h3><UserRound size={16} aria-hidden="true" /> {t('Your emergency contact')}</h3>
            {profile?.contactPhone ? (
              <a className="emergency-call emergency-contact emergency-contact-call" href={dial(profile.contactPhone)}>
                <strong>{t('Call my emergency contact')}</strong>
                <span>{[profile.contactName, profile.contactRelation, profile.contactPhone].filter(Boolean).join(' · ')}</span>
              </a>
            ) : (
              <p className="continuity-muted">{t('Not added yet')}</p>
            )}
          </div>
          <div className="continuity-note">
            <h3><HospitalIcon size={16} aria-hidden="true" /> {t('Your preferred hospital')}</h3>
            {profile?.hospitalName ? (
              <>
                <p><strong>{profile.hospitalName}</strong>{profile.hospitalAddress ? ` · ${profile.hospitalAddress}` : ''}</p>
                {profile.hospitalPhone && (
                  <a className="emergency-call emergency-contact" href={dial(profile.hospitalPhone)}>
                    <strong>{t('Call')}</strong>
                    <span>{profile.hospitalPhone}</span>
                  </a>
                )}
              </>
            ) : (
              <p className="continuity-muted">{t('Not added yet')}</p>
            )}
          </div>
        </div>
        )}
        <div className="continuity-actions">
          {overview && overview.me && (
            <button ref={cardButton} type="button" className="btn-primary emergency-card-button" onClick={() => setCardOpen(true)}>
              <IdCard size={18} aria-hidden="true" /> {t('Show this to the hospital')}
            </button>
          )}
          {from !== 'built-in' && (!profile?.contactPhone || !profile?.hospitalName) && (
            <button className="btn-secondary" onClick={() => { if (details.current) { details.current.open = true; details.current.scrollIntoView({ behavior: 'smooth' }); } }}>
              {t('Add details')}
            </button>
          )}
        </div>
      </Panel>

      {clinic && clinic.hospitals.length > 0 && (
        <Panel title={t('Hospitals your clinic recommends')} aside={<HospitalIcon size={18} aria-hidden="true" />}>
          <p className="continuity-muted">{t('These hospitals were chosen by your doctor’s clinic. In an emergency, call 112 or 108 first.')}</p>
          {clinic.hospitals.map((h) => (
            <article key={h.id} className="continuity-item">
              <h3>{h.name}</h3>
              {h.note && <p>{h.note}</p>}
              {h.address && <p className="continuity-muted">{h.address}</p>}
              <div className="continuity-actions">
                {h.phone && <a className="btn-secondary" href={dial(h.phone)}>{t('Call')} {h.phone}</a>}
                <a className="btn-secondary" href={mapsPlace(h.name, h.address)} target="_blank" rel="noreferrer">{t('Directions')}</a>
              </div>
            </article>
          ))}
        </Panel>
      )}

      {from === 'live' && (
        <Panel title={t('Hospitals near you')} aside={<MapPin size={18} aria-hidden="true" />}>
          <p className="continuity-muted">
            {usingCurrent
              ? t('Using your current location')
              : profile?.hasHome
                ? t('Using your saved location: {place}', { place: profile.homeLabel ?? '' })
                : t('Add your area, or use your current location, to see hospitals near you.')}
          </p>
          <div className="continuity-actions">
            <button className="btn-secondary" disabled={where.status === 'asking'} onClick={() => void where.locate()}>
              {where.status === 'asking' ? t('Finding your location…') : t('Use my current location')}
            </button>
          </div>
          {where.status === 'denied' && <p role="alert" className="continuity-alert">{t('Location is switched off for this site. You can allow it in your browser settings, or type your area below.')}</p>}
          {where.status === 'unavailable' && <p role="alert" className="continuity-alert">{t('Your device could not find your location. Check that location is on.')}</p>}
          <label className="continuity-check">
            <input
              type="checkbox"
              checked={where.tracking}
              onChange={(e) => {
                where.setTracking(e.target.checked);
                if (e.target.checked) void where.locate();
                if (profile) {
                  const body = { ...toInput(toForm(profile)), liveLocation: e.target.checked };
                  void saveEmergency(body).then((o) => { setOverview(o); where.setHome(o.profile); }).catch(() => { /* the choice still applies on this device */ });
                }
              }}
            />
            {t('Keep my location up to date while MaternaSync is open')}
          </label>
          <p className="continuity-muted">{t('Used only to find hospitals near you. It is not shared with your doctors or care team, and it stops when you close the app.')}</p>

          {loadingHospitals && <p role="status">{t('Finding hospitals near you…')}</p>}
          {nearby?.error && (
            <p role="alert" className="continuity-alert">
              {t('We could not load nearby hospitals just now. Use the numbers above, or search a map.')}{' '}
              <a href={mapsSearch(nearby.usedPosition?.lat, nearby.usedPosition?.lon)} target="_blank" rel="noreferrer">{t('Search for hospitals on a map')}</a>
            </p>
          )}
          {nearby && !nearby.error && !nearby.needsLocation && nearby.hospitals.length === 0 && <Empty>{t('No hospitals were found near this location.')}</Empty>}
          {nearby && !nearby.error && nearby.hospitals.length > 0 && (
            <p className="emergency-osm-note" role="note"><strong>{t('May not offer maternity care. Call first.')}</strong></p>
          )}
          {nearby?.hospitals.map((h) => (
            <article key={`${h.name}-${h.lat}-${h.lon}`} className="continuity-item">
              <h3>
                {h.name} {h.emergencyDepartment && <Badge>{t('Emergency department')}</Badge>}
              </h3>
              <p className="continuity-muted">{[t('{km} km away', { km: h.distanceKm }), h.address].filter(Boolean).join(' · ')}</p>
              <div className="continuity-actions">
                {h.phone && <a className="btn-secondary" href={dial(h.phone.split(';')[0])}>{t('Call')} {h.phone.split(';')[0]}</a>}
                <a className="btn-secondary" href={h.directionsUrl} target="_blank" rel="noreferrer">{t('Directions')}</a>
              </div>
            </article>
          ))}
          {nearby && !nearby.needsLocation && <p className="continuity-muted">{t('This list comes from OpenStreetMap. Phone numbers can be missing or out of date, so in an emergency call 112 or 108 first.')}</p>}
        </Panel>
      )}

      {form && from !== 'built-in' && (
        <details ref={details} className="glass-panel continuity-panel emergency-details">
          <summary><h2 style={{ display: 'inline' }}>{t('My emergency details')}</h2></summary>
          <p className="continuity-muted">{t('Only you can see these. They are used to show you help on this page and are not shared with your doctors or care team.')}</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void action.run(async () => {
                const saved = await saveEmergency({ ...toInput(form), liveLocation: where.tracking });
                keepEmergency(userId, saved);
                setOverview(saved);
                setForm(toForm(saved.profile));
                where.setHome(saved.profile);
                fetched.current = '';
                if (saved.located === false) throw new Error(tx('We could not find that area on the map. Try a nearby town, or use your current location.'));
              }, t('Saved.'));
            }}
          >
            <div className="continuity-fields">
              <Field label={t('Area or city')}>
                <input maxLength={200} value={form.homeLabel} onChange={(e) => setForm({ ...form, homeLabel: e.target.value, homeLat: null, homeLon: null })} />
              </Field>
              <Field label={t('Emergency contact name')}><input maxLength={120} value={form.contactName} onChange={(e) => set('contactName', e.target.value)} /></Field>
              <Field label={t('Relationship')}><input maxLength={60} value={form.contactRelation} onChange={(e) => set('contactRelation', e.target.value)} /></Field>
              <Field label={t('Emergency contact phone')}><input type="tel" maxLength={30} value={form.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} /></Field>
              <Field label={t('Preferred hospital')}><input maxLength={200} value={form.hospitalName} onChange={(e) => set('hospitalName', e.target.value)} /></Field>
              <Field label={t('Hospital phone')}><input type="tel" maxLength={30} value={form.hospitalPhone} onChange={(e) => set('hospitalPhone', e.target.value)} /></Field>
              <Field label={t('MCP card number')}><input maxLength={30} value={form.mcpNumber} onChange={(e) => set('mcpNumber', e.target.value)} /></Field>
            </div>
            <Field label={t('Hospital address')}><input maxLength={300} value={form.hospitalAddress} onChange={(e) => set('hospitalAddress', e.target.value)} /></Field>
            <div className="continuity-actions">
              <button className="btn-primary" disabled={action.busy}>{t('Save details')}</button>
              <button type="button" className="btn-secondary" disabled={where.status === 'asking'} onClick={() => void setHomeHere()}>
                {form.homeLat !== null && !profile?.hasHome ? t('Home set to where you are now. Save to keep it.') : t('Set my home to where I am now')}
              </button>
            </div>
          </form>
        </details>
      )}
      {cardOpen && overview && <HospitalCard overview={overview} onClose={() => { setCardOpen(false); cardButton.current?.focus(); }} />}
    </Page>
  );
}

function toInput(form: Form) {
  const blank = (text: string) => text.trim() || null;
  return {
    homeLabel: blank(form.homeLabel), homeLat: form.homeLat, homeLon: form.homeLon,
    contactName: blank(form.contactName), contactRelation: blank(form.contactRelation), contactPhone: blank(form.contactPhone),
    hospitalName: blank(form.hospitalName), hospitalPhone: blank(form.hospitalPhone), hospitalAddress: blank(form.hospitalAddress),
    mcpNumber: blank(form.mcpNumber),
    liveLocation: false,
  };
}
