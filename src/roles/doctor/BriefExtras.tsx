import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, Users } from 'lucide-react';
import { doctorTrustedPeople } from '../../api/caregiver';
import type { DoctorTrustedPerson, Permission } from '../../api/caregiver';
import { fetchOpenVisitChanges } from '../../api/doctorWorkspace';
import type { OpenVisitChange } from '../../api/doctorWorkspace';
import { PERMISSION_WORDS } from '../../components/continuity/CareWorkspacePage';
import { tx, useLanguage } from '../../i18n';
import { formatFriendlyDate, formatFriendlyDateTime } from './format';

const NOTHING = tx('She has not added a trusted person, and no request about a visit is waiting.');

/** At the top of the brief: the people she lets help her (read-only: it is hers) and any request she made to move or cancel a confirmed visit that
 *  is still waiting for the doctor. Each card shows only when there is something to show; when neither does, one quiet line says so. */
export function BriefExtras({ episodeId }: { episodeId: string }) {
  const { t } = useLanguage();
  const [people, setPeople] = useState<DoctorTrustedPerson[] | null>(null);
  const [changes, setChanges] = useState<OpenVisitChange[] | null>(null);

  useEffect(() => {
    let current = true;
    setPeople(null);
    setChanges(null);
    // Each one fails quietly: the rest of the brief is more important than these two cards.
    doctorTrustedPeople(episodeId).then((r) => { if (current) setPeople(r.items); }).catch(() => { if (current) setPeople([]); });
    fetchOpenVisitChanges(episodeId).then((r) => { if (current) setChanges(r); }).catch(() => { if (current) setChanges([]); });
    return () => { current = false; };
  }, [episodeId]);

  if (people === null || changes === null) return null;
  // Someone whose access has ended is not "helping her" any more, but is still listed, with a badge, as in Connected Care.
  if (!people.length && !changes.length) {
    return <p className="continuity-muted brief-extras-empty" role="status">{t(NOTHING)}</p>;
  }

  return (
    <div className="brief-extras">
      {changes.length > 0 && (
        <section className="glass-panel brief-extra brief-extra-change" aria-labelledby="brief-change-title">
          <h2 id="brief-change-title"><CalendarClock size={16} aria-hidden="true" /> {t('She asked to change a visit')}</h2>
          <ul>
            {changes.map((c) => (
              <li key={c.taskId}>
                <p>
                  {c.kind === 'reschedule' && c.preferredAt
                    ? t('She asks to move the visit of {visit} to {when}.', { visit: `${c.visitType} · ${formatFriendlyDateTime(c.visitAt)}`, when: formatFriendlyDateTime(c.preferredAt) })
                    : t('She asks to cancel the visit of {visit}.', { visit: `${c.visitType} · ${formatFriendlyDateTime(c.visitAt)}` })}
                </p>
                {c.note && <p className="continuity-muted">{t('Her note: {note}', { note: c.note })}</p>}
                {c.requestedAt && <p className="continuity-muted">{t('Asked on {date}', { date: formatFriendlyDate(c.requestedAt) })}</p>}
                <Link className="btn-secondary" to={`/doctor/care-workspace?episodeId=${episodeId}&tab=operations`}>{t('Open the task')}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {people.length > 0 && (
        <section className="glass-panel brief-extra" aria-labelledby="brief-people-title">
          <h2 id="brief-people-title"><Users size={16} aria-hidden="true" /> {t('Her trusted people')}</h2>
          <p className="continuity-muted">{t('The people she has added to help her, and what she lets each of them do. You can see this but not change it: it is hers.')}</p>
          <ul>
            {people.map((p) => {
              const allowed = (Object.keys(PERMISSION_WORDS) as Permission[]).filter((key) => p.permissions[key]);
              return (
                <li key={p.linkId}>
                  <p className="brief-person">
                    <strong>{p.name}</strong>{p.relationship ? ` · ${p.relationship}` : ''} {p.ended && <span className="brief-badge">{t('Access ended')}</span>}
                  </p>
                  <p className="brief-chips" aria-label={t('What she allows')}>
                    {allowed.length
                      ? allowed.map((key) => <span key={key} className="brief-badge">{t(PERMISSION_WORDS[key])}</span>)
                      : <span className="continuity-muted">{t('Nothing allowed yet')}</span>}
                  </p>
                  <p className="continuity-muted">
                    {p.accessUntil ? t('Access until the end of {date}.', { date: new Date(p.accessUntil).toLocaleDateString() }) : t('No end date set.')}
                  </p>
                </li>
              );
            })}
          </ul>
          <Link className="brief-link" to={`/doctor/care-workspace?episodeId=${episodeId}&tab=reminders`}>{t('See them in Connected Care')}</Link>
        </section>
      )}
    </div>
  );
}
