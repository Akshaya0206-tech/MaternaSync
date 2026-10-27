import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { CaregiverCheckIn } from '../../api/caregiver';
import { CHECK_INS_PER_PAGE, caregiverCheckInStatus, caregiverCheckInsPage, remindHerToCheckIn } from '../../api/caregiverCheckIns';
import type { CheckInStatus } from '../../api/caregiverCheckIns';
import { ApiError } from '../../api/client';
import { formatTime } from '../../api/continuity';
import { useAuth } from '../../auth/AuthContext';
import { useLanguage } from '../../i18n';
import { isUnreachable } from '../../offline/pendingCheckIns';
import { rememberedCheckInWoman, sendOrKeepCaregiverCheckIn, useWaitingCaregiverCheckIns } from '../../offline/pendingCaregiverCheckIns';
import { Empty, Feedback, Page, Panel, useAction } from '../../components/continuity/shared';
import { GuidedCheckInForm } from '../patient/GuidedCheckInForm';
import { useCaregiver } from './CaregiverContext';
import { Needs } from './CaregiverGuards';

/**
 * The check-in pages need the woman's link number. With no signal the app cannot ask who the helper is looking after, so the one remembered from
 * the last visit (kept only while she allows check-ins) lets the form open anyway and the check-in be kept on the phone. The server still
 * decides what is allowed the moment anything is sent.
 */
function NeedsCheckIn({ title, children }: { title: string; children: (linkId: string, womanName: string) => ReactNode }) {
  const { user } = useAuth();
  const { women, current, error } = useCaregiver();
  const kept = user && women !== null && !current && error ? rememberedCheckInWoman(user.id) : null;
  if (kept) return <>{children(kept.linkId, kept.womanName)}</>;
  return <Needs permission="check_in" title={title}>{(linkId) => children(linkId, current?.womanName ?? '')}</Needs>;
}

/** Whole calendar days between that moment and today on this phone's clock: 0 is today, 1 is yesterday. */
function daysAgo(iso: string): number {
  const day = (moment: Date) => new Date(moment.getFullYear(), moment.getMonth(), moment.getDate()).getTime();
  return Math.max(0, Math.round((day(new Date()) - day(new Date(iso))) / 86_400_000));
}

// ---------------------------------------------------------------- Daily Check-in
export function CaregiverCheckInPage() {
  const { t } = useLanguage();
  return (
    <NeedsCheckIn title={t('Daily Check-in')}>
      {(linkId) => <CheckIns linkId={linkId} />}
    </NeedsCheckIn>
  );
}

/** When her last check-in was, and a way to remind her (a few a day; she sees each one in her Updates). */
function LastCheckIn({ linkId, status, onStatus }: { linkId: string; status: CheckInStatus | null; onStatus: (next: CheckInStatus) => void }) {
  const { t } = useLanguage();
  const action = useAction();
  if (!status) return null;
  const days = status.lastCheckInAt ? daysAgo(status.lastCheckInAt) : null;
  const heading = days === null ? t('No check-in has been filled in yet.')
    : days === 0 ? t('Last check-in: today')
      : days === 1 ? t('Last check-in: yesterday')
        : t('Last check-in: {count} days ago', { count: days });
  const remind = () => action.run(async () => {
    try {
      onStatus(await remindHerToCheckIn(linkId));
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) throw new Error(t('You have already sent {count} reminders in the last day. Please try again later.', { count: status.nudgeLimit }));
      if (isUnreachable(error)) throw new Error(t('No signal right now. Please try again when you are back online.'));
      throw error;
    }
  }, t('Your reminder was sent. She will see it in her Updates.'));
  return (
    <Panel title={t('Her last check-in')}>
      <p><strong>{heading}</strong></p>
      {status.lastCheckInAt && <p className="continuity-muted">{formatTime(status.lastCheckInAt)}</p>}
      <Feedback error={action.error} message={action.message} />
      {days !== 0 && (
        <div className="continuity-actions">
          <button type="button" className="btn-secondary" disabled={action.busy || status.nudgesLeft <= 0} onClick={() => void remind()}>{t('Remind her')}</button>
          <span className="continuity-muted">{t('Reminders left today: {count}', { count: status.nudgesLeft })}</span>
        </div>
      )}
      {days !== 0 && <p className="continuity-muted">{t('This sends her a short note in her Updates, asking her to fill in today’s check-in. It says nothing else.')}</p>}
    </Panel>
  );
}

function CheckIns({ linkId }: { linkId: string }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [items, setItems] = useState<CaregiverCheckIn[] | null>(null);
  const [more, setMore] = useState(false);
  const [error, setError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [status, setStatus] = useState<CheckInStatus | null>(null);

  const say = useCallback((err: unknown) => (isUnreachable(err) ? t('No signal right now. The list of check-ins will load when you are back online.') : err instanceof Error ? err.message : ''), [t]);

  const load = useCallback(async () => {
    try {
      const [page, state] = await Promise.all([caregiverCheckInsPage(linkId, 0), caregiverCheckInStatus(linkId)]);
      setItems(page);
      setMore(page.length >= CHECK_INS_PER_PAGE);
      setStatus(state);
      setError('');
    } catch (err) {
      setError(say(err));
      setItems((old) => old ?? []);
    }
  }, [linkId, say]);

  useEffect(() => {
    setItems(null);
    setStatus(null);
    void load();
  }, [load]);

  // A check-in that was waiting on the phone has gone through: show it in the list.
  const waiting = useWaitingCaregiverCheckIns(user?.id ?? '').filter((item) => item.linkId === linkId).length;
  const before = useRef(waiting);
  useEffect(() => {
    if (waiting < before.current) void load();
    before.current = waiting;
  }, [waiting, load]);

  const older = async () => {
    setLoadingMore(true);
    try {
      const page = await caregiverCheckInsPage(linkId, items?.length ?? 0);
      setItems((old) => [...(old ?? []), ...page]);
      setMore(page.length >= CHECK_INS_PER_PAGE);
      setError('');
    } catch (err) {
      setError(say(err));
    } finally {
      setLoadingMore(false);
    }
  };

  const shown = items?.filter((c) => !c.skipped) ?? [];
  return (
    <Page title={t('Daily Check-in')} subtitle={t('Fill in a check-in with her, one question at a time. It is saved as her check-in, with your name beside it so the doctor knows who helped.')}>
      <Feedback error={error} />
      <LastCheckIn linkId={linkId} status={status} onStatus={setStatus} />
      <div className="continuity-actions">
        <Link className="btn-primary" to="/caregiver/check-in/new">{t('Fill in a check-in with her')}</Link>
      </div>
      <Panel title={t('Recent check-ins')}>
        {items === null && <p role="status" className="continuity-muted">{t('Loading…')}</p>}
        {items && !shown.length && !more && <Empty>{t('No check-in has been filled in yet.')}</Empty>}
        {shown.map((c) => (
          <article key={c.id} className="continuity-item">
            <h3>{formatTime(c.recordedAt)}</h3>
            <p>
              {c.systolic && c.diastolic ? `${t('BP')} ${c.systolic}/${c.diastolic} mmHg · ` : ''}
              {c.weightKg ? `${t('Weight')} ${c.weightKg} kg · ` : ''}
              {c.symptoms || t('No symptoms entered')}
            </p>
            {c.enteredWithHelp && <p className="continuity-muted">{t('Filled in by')}: {c.enteredWithHelp}</p>}
          </article>
        ))}
        {more && (
          <button type="button" className="btn-secondary" disabled={loadingMore} onClick={() => void older()}>
            {loadingMore ? t('Loading…') : t('Show older check-ins')}
          </button>
        )}
        {items && !more && shown.length > 0 && items.length > CHECK_INS_PER_PAGE && <p className="continuity-muted">{t('These are all her check-ins.')}</p>}
      </Panel>
    </Page>
  );
}

// ---------------------------------------------------------------- Step-by-step check-in
export function CaregiverNewCheckInPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const userId = user?.id ?? '';
  return (
    <NeedsCheckIn title={t('Daily Check-in')}>
      {(linkId, womanName) => (
        <GuidedCheckInForm
          key={linkId}
          ready
          skipWho
          readAloudChecks
          filledInBy={t('You ({name}), for her', { name: user?.fullName ?? '' })}
          save={async (body) => {
            // Without a signal the check-in is kept on this phone and sent later; it is never lost and never saved twice.
            const result = await sendOrKeepCaregiverCheckIn(userId, linkId, womanName, body as unknown as Record<string, unknown>);
            if (result === 'queued') return t('No signal right now. The check-in is kept on this phone and will be sent when you are back online.');
          }}
          subtitle={t('One question at a time. Ask her, or read it out to her. The answers are saved as her check-in, with your name beside it.')}
          savedText={t('The check-in was saved for her doctor.')}
          doneTo="/caregiver/check-in"
          doneLabel={t('Back to the check-ins')}
          draftKey={userId ? `maternasync.guided-draft.caregiver.${userId}.${linkId}` : undefined}
        />
      )}
    </NeedsCheckIn>
  );
}
