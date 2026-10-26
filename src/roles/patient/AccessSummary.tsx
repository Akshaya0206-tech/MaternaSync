import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { HeartHandshake, MessageCircleMore, Users } from 'lucide-react';
import { listTrusted } from '../../api/caregiver';
import type { Permission, TrustedPerson } from '../../api/caregiver';
import { formatTime } from '../../api/continuity';
import type { Workspace } from '../../api/continuity';
import { Badge, Empty, Panel } from '../../components/continuity/shared';
import { tx, useLanguage } from '../../i18n';
import { formatFriendlyDate } from './format';

// The same sentences as on Profile -> Trusted people, so she reads one wording in both places.
const MAY_DO: Record<Permission, string> = {
  appointments: tx('See my appointments'),
  check_in: tx('See my daily check-ins and fill one in with me'),
  care_plan: tx('Read the summaries and instructions my doctor has released to me'),
  reminders: tx('See when my reminders are due. Medicine and vaccine names show only if I also allow the summaries and instructions above'),
  questions: tx('Ask the doctor a question, and read the replies'),
  emergency: tx('See my emergency numbers, my emergency contact and my preferred hospital'),
};
const PERSON_STATUS: Record<TrustedPerson['status'], string> = { INVITED: tx('Waiting to join'), ACTIVE: tx('Active'), REVOKED: tx('Removed') };
const PURPOSES: Record<string, string> = {
  reminders: tx('Care reminders'),
  approved_documents: tx('Approved document notifications'),
};

/** One place that says who can see her information or get a message about her: her doctor and clinic, the trusted people she added, and the
 *  WhatsApp numbers she allowed. It only reads what she already has; the trusted people are changed on Profile, the numbers can be withdrawn here. */
export function AccessSummary({ consents, busy, onRevoke }: { consents: Workspace['consents']; busy: boolean; onRevoke: (id: string) => void }) {
  const { t } = useLanguage();
  const [people, setPeople] = useState<TrustedPerson[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    listTrusted()
      .then((result) => { if (active) setPeople(result.items.filter((person) => person.status !== 'REVOKED')); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);

  return (
    <Panel title={t('Who can see or get what')}>
      <section className="access-group" aria-labelledby="access-doctor">
        <h3 id="access-doctor"><HeartHandshake size={16} aria-hidden="true" /> {t('Your doctor and clinic')}</h3>
        <p>{t('Your doctor and your doctor’s clinic can see what you put into MaternaSync: your check-ins, your questions, the records you upload and your visits. This is how they look after you.')}</p>
      </section>

      <section className="access-group" aria-labelledby="access-people">
        <h3 id="access-people"><Users size={16} aria-hidden="true" /> {t('Trusted people')}</h3>
        {people === null && !failed && <p role="status" className="continuity-muted">{t('Loading…')}</p>}
        {failed && <p className="continuity-muted">{t('We could not load your trusted people. Open your Profile to see them.')}</p>}
        {people?.length === 0 && (
          <Empty>
            {t('You have not added anyone. You can invite a relative or a friend from your Profile.')}
          </Empty>
        )}
        {people?.map((person) => (
          <article key={person.id} className="access-item">
            <h4>
              {person.displayName}
              {person.relationship && !person.displayName.toLowerCase().includes(person.relationship.toLowerCase()) ? ` · ${person.relationship}` : ''} <Badge>{t(person.ended ? 'Access ended' : PERSON_STATUS[person.status])}</Badge>
            </h4>
            <ul className="continuity-list">
              {(Object.keys(MAY_DO) as Permission[]).filter((key) => person.permissions[key]).map((key) => <li key={key}>{t(MAY_DO[key])}</li>)}
            </ul>
            <p className="continuity-muted">
              {person.accessUntil
                ? t('Access until the end of {date}.', { date: formatFriendlyDate(person.accessUntil) })
                : t('No end date: they can help until you remove them.')}
            </p>
          </article>
        ))}
        {people && (
          <p><Link className="btn-secondary" to="/patient/profile">{t('Change this in Profile')}</Link></p>
        )}
      </section>

      <section className="access-group" aria-labelledby="access-whatsapp">
        <h3 id="access-whatsapp"><MessageCircleMore size={16} aria-hidden="true" /> {t('WhatsApp messages')}</h3>
        {!consents.length && <Empty>{t('No external sharing permissions granted.')}</Empty>}
        {consents.map((c) => (
          <article key={c.id} className="access-item">
            <h4>
              {c.recipient} <Badge>{c.revokedAt ? t('Revoked') : c.active ? t('Active') : t('Expired')}</Badge>
            </h4>
            <p>
              {t(PURPOSES[c.purpose] ?? c.purpose.replaceAll('_', ' '))} · {t('Expires {time}', { time: formatTime(c.expiresAt) })}
            </p>
            {c.active && (
              <button type="button" className="btn-secondary" disabled={busy} onClick={() => onRevoke(c.id)}>
                {t('Revoke / opt out')}
              </button>
            )}
          </article>
        ))}
      </section>
    </Panel>
  );
}
