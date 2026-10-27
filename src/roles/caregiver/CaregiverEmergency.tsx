import { useCallback, useEffect, useRef, useState } from 'react';
import { Hospital as HospitalIcon, IdCard, Phone, UserRound } from 'lucide-react';
import { caregiverEmergency } from '../../api/caregiver';
import type { CaregiverEmergency } from '../../api/caregiver';
import { caregiverClinicHospitals, caregiverHospitalCard, reportHospitalCardOpened } from '../../api/caregiverEmergency';
import type { HospitalCardData } from '../../api/caregiverEmergency';
import { ApiError } from '../../api/client';
import { formatTime } from '../../api/continuity';
import type { ClinicHospital } from '../../api/emergency';
import { directionsUrl } from '../../calendar/calendarFile';
import {
  clearPendingCardOpened, forgetCaregiverEmergency, keepCaregiverEmergency, keptCaregiverEmergency, keptLinkToShow, pendingCardOpened, queueCardOpened,
} from '../../offline/caregiverEmergencyCache';
import { useOnline } from '../../offline/useOnline';
import { useLanguage } from '../../i18n';
import { Empty, Feedback, Page, Panel } from '../../components/continuity/shared';
import { BUILT_IN_OVERVIEW } from '../patient/emergencyCache';
import { CaregiverHospitalCard } from './CaregiverHospitalCard';
import { useCaregiver } from './CaregiverContext';
import { Needs } from './CaregiverGuards';

const dial = (number: string) => `tel:${number.replace(/[^\d+]/g, '')}`;

/** Everything the page shows about her, in one piece, so it can be kept on the phone and shown again with no signal. */
interface Loaded {
  emergency: CaregiverEmergency;
  card: HospitalCardData | null;
  hospitals: ClinicHospital[];
}

/** Where what is on the page came from: the server just now, the copy kept on this phone, or the numbers built into the app. */
type Source = 'live' | 'phone' | 'built-in';

// ---------------------------------------------------------------- Emergency
export function CaregiverEmergencyPage() {
  const { t } = useLanguage();
  const { women, current, error } = useCaregiver();
  // The numbers must show whatever happens. While her list is still loading, or if it could not be loaded (no signal), the page still opens:
  // with the copy kept on this phone when there is one, and always with the numbers built into the app.
  if (women === null) return <Emergency linkId={null} waiting />;
  if (!current && !women.length && error) return <Emergency linkId={keptLinkToShow()} />;
  return (
    <Needs permission="emergency" title={t('Emergency help')}>
      {(linkId) => <Emergency linkId={linkId} />}
    </Needs>
  );
}

/** Tells the server about any openings of the hospital card that happened with no signal, so they still reach her record. */
async function sendWaitingOpenings(linkId: string) {
  const waiting = pendingCardOpened(linkId);
  if (!waiting.length) return;
  clearPendingCardOpened(linkId);
  for (let index = 0; index < waiting.length; index += 1) {
    try {
      await reportHospitalCardOpened(linkId, waiting[index]);
    } catch (err) {
      if (!(err instanceof ApiError)) {
        waiting.slice(index).forEach((at) => queueCardOpened(linkId, at));
        return;
      }
    }
  }
}

function Emergency({ linkId, waiting = false }: { linkId: string | null; waiting?: boolean }) {
  const { t } = useLanguage();
  const { current } = useCaregiver();
  const online = useOnline();
  const [data, setData] = useState<Loaded | null>(null);
  const [from, setFrom] = useState<Source>(linkId ? 'live' : 'built-in');
  const [savedAt, setSavedAt] = useState('');
  const [savedFor, setSavedFor] = useState('');
  const [refused, setRefused] = useState('');
  const [cardOpen, setCardOpen] = useState(false);
  const cardButton = useRef<HTMLButtonElement>(null);
  const name = current && current.linkId === linkId ? current.womanName : savedFor;
  const nameNow = useRef(name);
  useEffect(() => { nameNow.current = name; }, [name]);

  // The server's page when it answers; otherwise the copy kept on this phone; otherwise the numbers built into the app. If the server says no (she
  // removed this person, switched this off, or the end date passed) nothing of hers is shown and the copy on the phone is thrown away.
  const load = useCallback(() => {
    if (!linkId) return undefined;
    let active = true;
    void Promise.allSettled([caregiverEmergency(linkId), caregiverHospitalCard(linkId), caregiverClinicHospitals(linkId)]).then(([emergency, card, hospitals]) => {
      if (!active) return;
      const refusal = [emergency, card, hospitals].find((result) => result.status === 'rejected' && result.reason instanceof ApiError && (result.reason.status === 403 || result.reason.status === 404));
      if (refusal && refusal.status === 'rejected') {
        forgetCaregiverEmergency(linkId);
        setData(null);
        setFrom('built-in');
        setRefused(refusal.reason.message);
        return;
      }
      setRefused('');
      if (emergency.status === 'fulfilled' && card.status === 'fulfilled' && hospitals.status === 'fulfilled') {
        const live = { emergency: emergency.value, card: card.value, hospitals: hospitals.value };
        keepCaregiverEmergency(linkId, nameNow.current, live);
        setData(live);
        setFrom('live');
        void sendWaitingOpenings(linkId);
        return;
      }
      const kept = keptCaregiverEmergency(linkId);
      if (kept) {
        setData(kept);
        setFrom('phone');
        setSavedAt(kept.savedAt);
        setSavedFor(kept.womanName);
      } else if (emergency.status === 'fulfilled') {
        setData({ emergency: emergency.value, card: card.status === 'fulfilled' ? card.value : null, hospitals: hospitals.status === 'fulfilled' ? hospitals.value : [] });
        setFrom('live');
      } else {
        setFrom('built-in');
      }
    });
    return () => { active = false; };
  }, [linkId]);

  useEffect(() => load(), [load]);
  // Back online after a time without signal: ask again, so the page is the server's again.
  const wasOffline = useRef(false);
  useEffect(() => {
    if (!online) wasOffline.current = true;
    else if (wasOffline.current) { wasOffline.current = false; return load(); }
  }, [online, load]);

  const emergency = data?.emergency;
  const numbers = emergency?.numbers.length ? emergency.numbers : BUILT_IN_OVERVIEW.numbers;
  const note = emergency?.note || BUILT_IN_OVERVIEW.note;
  const place = (emergency?.hospitalName ?? '') + (emergency?.hospitalAddress ? `, ${emergency.hospitalAddress}` : '');
  const loadingHer = Boolean(linkId) && from === 'live' && !data && !refused;

  const openCard = () => {
    setCardOpen(true);
    if (!linkId) return;
    const at = new Date().toISOString();
    reportHospitalCardOpened(linkId).catch((err) => { if (!(err instanceof ApiError)) queueCardOpened(linkId, at); });
  };

  return (
    <Page title={t('Emergency help')} subtitle={t('If she needs urgent help, call now. These are her saved details, shown to you because she allowed it.')}>
      <Feedback error={refused} />
      {(waiting || loadingHer) && <div className="continuity-note" role="status">{t('Loading her details. The numbers below work now.')}</div>}
      {from === 'phone' && (
        <div className="continuity-note" role="status">
          {t('Showing what was saved on this phone for {name} on {when}. It is updated when you are back online.', { name, when: formatTime(savedAt) })}
        </div>
      )}
      {from === 'built-in' && !waiting && !refused && (
        <div className="continuity-note" role="status">
          {t('Showing the standard numbers for India built into this app. Her own details appear when you are back online.')}
        </div>
      )}

      <Panel title={t('Her emergency contact')} aside={<UserRound size={18} aria-hidden="true" />}>
        {emergency?.contactPhone ? (
          <a className="emergency-call emergency-contact emergency-contact-call" href={dial(emergency.contactPhone)}>
            <strong>{t('Call her emergency contact')}</strong>
            <span>{[emergency.contactName, emergency.contactRelation, emergency.contactPhone].filter(Boolean).join(' · ')}</span>
          </a>
        ) : emergency ? (
          <Empty>{t('She has not saved an emergency contact, so there is no number to call here. Use the numbers below.')}</Empty>
        ) : (
          <Empty>{t('Her emergency contact appears here when her details have loaded.')}</Empty>
        )}
      </Panel>

      <Panel title={t('Numbers to call')} aside={<Phone size={18} aria-hidden="true" />}>
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
        {data?.card && (
          <div className="continuity-actions">
            <button ref={cardButton} type="button" className="btn-primary emergency-card-button" onClick={openCard}>
              <IdCard size={18} aria-hidden="true" /> {t('Show this to the hospital')}
            </button>
          </div>
        )}
      </Panel>

      {emergency && (
        <Panel title={t('Her preferred hospital')} aside={<HospitalIcon size={18} aria-hidden="true" />}>
          {emergency.hospitalName ? (
            <>
              <p><strong>{emergency.hospitalName}</strong>{emergency.hospitalAddress ? ` · ${emergency.hospitalAddress}` : ''}</p>
              <div className="continuity-actions">
                {emergency.hospitalPhone && (
                  <a className="btn-secondary" href={dial(emergency.hospitalPhone)}>{t('Call')} {emergency.hospitalPhone}</a>
                )}
                <a className="btn-secondary" href={directionsUrl(place)} target="_blank" rel="noreferrer" aria-label={t('Directions to {place}', { place: emergency.hospitalName })}>{t('Directions')}</a>
              </div>
            </>
          ) : <Empty>{t('She has not saved a preferred hospital.')}</Empty>}
        </Panel>
      )}

      {data && data.hospitals.length > 0 && (
        <Panel title={t('Hospitals her clinic recommends')} aside={<HospitalIcon size={18} aria-hidden="true" />}>
          <p className="continuity-muted">{t('These hospitals were chosen by her doctor’s clinic. In an emergency, call 112 or 108 first.')}</p>
          {data.hospitals.map((h) => (
            <article key={h.id} className="continuity-item">
              <h3>{h.name}</h3>
              {h.note && <p>{h.note}</p>}
              {h.address && <p className="continuity-muted">{h.address}</p>}
              <div className="continuity-actions">
                {h.phone && <a className="btn-secondary" href={dial(h.phone)}>{t('Call')} {h.phone}</a>}
                <a className="btn-secondary" href={directionsUrl([h.name, h.address].filter(Boolean).join(', '))} target="_blank" rel="noreferrer" aria-label={t('Directions to {place}', { place: h.name })}>{t('Directions')}</a>
              </div>
            </article>
          ))}
        </Panel>
      )}
      {cardOpen && data?.card && <CaregiverHospitalCard card={data.card} onClose={() => { setCardOpen(false); cardButton.current?.focus(); }} />}
    </Page>
  );
}
