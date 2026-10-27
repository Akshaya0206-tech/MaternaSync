import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { answerCheckInHelper, caregiverHome, caregiverTalk } from '../../api/caregiver';
import type { HomeSummary, Permission } from '../../api/caregiver';
import { formatTime } from '../../api/continuity';
import { tx, useLanguage } from '../../i18n';
import { Badge, Empty, Feedback, Field, Page, Panel, useAction } from '../../components/continuity/shared';
import { formatFriendlyDate } from '../patient/format';
import { useCaregiver } from './CaregiverContext';
import { EndedNotice, JoinForm, NotLinked } from './CaregiverGuards';
import { CaregiverTodayCard } from './CaregiverTodayCard';
import { StopHelpingCard } from './StopHelpingCard';
import { useForWoman } from './useForWoman';
import { WhatsAppLine } from './WhatsAppLine';

// What each permission lets a trusted person do, in the words she sees when she chooses (the same words are used on her side).
const PERMISSION_TEXT: Record<Permission, string> = {
  appointments: tx('See her appointments'),
  check_in: tx('See her daily check-ins and fill one in with her'),
  care_plan: tx('Read the summaries and instructions her doctor has released to her'),
  reminders: tx('See when her reminders are due. Medicine and vaccine names show only if she also allows the summaries and instructions above'),
  questions: tx('Ask the doctor a question, and read the replies'),
  emergency: tx('See her emergency numbers, her emergency contact and her preferred hospital'),
};

/** A doctor asked this person to help with her daily check-ins. They can say yes or no, and change their answer; she is told each time. */
function HelperRequest({ linkId, womanName, request, onAnswered }: { linkId: string; womanName: string; request: NonNullable<HomeSummary['checkInHelper']>; onAnswered: () => void }) {
  const { t } = useLanguage();
  const action = useAction();
  const answer = (status: 'ACCEPTED' | 'DECLINED') => action.run(async () => {
    await answerCheckInHelper(linkId, status);
    onAnswered();
  }, '');
  return (
    <Panel title={t('Your doctor asked for your help')}>
      <p>{t('{doctor} asked you to help {name} fill in her daily check-ins. If she misses one, you are reminded first.', { doctor: request.askedBy, name: womanName.split(' ')[0] })}</p>
      <Feedback error={action.error} />
      <div className="continuity-actions">
        <button type="button" className={request.status === 'ACCEPTED' ? 'btn-primary' : 'btn-secondary'} aria-pressed={request.status === 'ACCEPTED'} disabled={action.busy} onClick={() => void answer('ACCEPTED')}>
          {t("Yes, I'll help")}
        </button>
        <button type="button" className={request.status === 'DECLINED' ? 'btn-primary' : 'btn-secondary'} aria-pressed={request.status === 'DECLINED'} disabled={action.busy} onClick={() => void answer('DECLINED')}>
          {t("No, I can't")}
        </button>
        {request.status === 'ACCEPTED' && <Link className="btn-secondary" to="/caregiver/check-in/new">{t('Fill in a check-in with her')}</Link>}
      </div>
      <p className="continuity-muted" role="status">
        {request.status === 'ASKED' ? t('You have not answered yet.') : request.status === 'ACCEPTED' ? t('You said yes. She has been told.') : t('You said no. She has been told, and nothing else changes.')}
      </p>
    </Panel>
  );
}

// ---------------------------------------------------------------- Home
export function CaregiverHomePage() {
  const { t } = useLanguage();
  const { women, current, error } = useCaregiver();
  const { hash } = useLocation();
  const summary = useForWoman<HomeSummary>(caregiverHome, !current?.ended);
  const talk = useAction();
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState('');

  useEffect(() => {
    if (hash === '#talk') document.getElementById('talk')?.scrollIntoView();
  }, [hash, summary.data]);

  if (women === null) return <Page title={t('Home')}><p role="status" className="continuity-muted">{t('Loading…')}</p></Page>;
  if (!current) return <NotLinked title={t('Home')} />;
  if (current.ended) return <EndedNotice title={t('Home')} />;
  const data = summary.data;
  return (
    <Page title={t('Home')} subtitle={t('What {name} has allowed you to see and do.', { name: current.womanName })}>
      <Feedback error={error || summary.error} />
      <CaregiverTodayCard />

      <Panel title={t('You are helping {name}', { name: current.womanName })}>
        <p>{current.relationship ? t('You are listed as: {relationship}.', { relationship: current.relationship }) : t('You are one of her trusted people.')}</p>
        {current.accessUntil && <p className="continuity-note" role="status">{t('Your access ends on {date}. {name} can extend it.', { date: formatFriendlyDate(current.accessUntil), name: current.womanName.split(' ')[0] })}</p>}
        <details className="caregiver-allowed">
          <summary>{t('What {name} has allowed', { name: current.womanName.split(' ')[0] })}</summary>
          <ul className="continuity-list">
            {(Object.keys(PERMISSION_TEXT) as Permission[]).map((permission) => (
              <li key={permission}>
                <Badge>{current.permissions[permission] ? t('Allowed') : t('Not allowed')}</Badge> {t(PERMISSION_TEXT[permission])}
              </li>
            ))}
          </ul>
          <p className="continuity-muted">{t('You never see her records, medicines, results or documents unless she has allowed it above, and her doctor’s notes are never shown here.')}</p>
        </details>
      </Panel>

      {current.permissions.appointments && data && (
        <Panel title={t('Next appointments')} aside={<Link className="btn-secondary" to="/caregiver/appointments">{t('All appointments')}</Link>}>
          {!data.upcoming?.length && <Empty>{t('No upcoming appointment is recorded.')}</Empty>}
          {data.upcoming?.map((a) => (
            <article key={a.id} className="continuity-item">
              <h3>{formatTime(a.scheduledAt)}</h3>
              <p>{a.type}{a.location ? ` · ${a.location}` : ''}</p>
            </article>
          ))}
        </Panel>
      )}

      {current.permissions.check_in && data?.checkInHelper && (
        <HelperRequest linkId={current.linkId} womanName={current.womanName} request={data.checkInHelper} onAnswered={() => void summary.reload()} />
      )}

      {current.permissions.check_in && data && (
        <Panel title={t('Daily check-in')}>
          <p>{data.lastCheckIn ? t('The last check-in was on {when}.', { when: formatTime(data.lastCheckIn) }) : t('No check-in has been filled in yet.')}</p>
          <Link className="btn-primary" to="/caregiver/check-in/new">{t('Fill in a check-in with her')}</Link>
        </Panel>
      )}

      <WhatsAppLine linkId={current.linkId} />

      <section id="talk">
        <Panel title={t('Talk to a person')}>
          <p>{t('This sends a message to her doctor and asks for a person to get back to you. It is not for emergencies: if it is urgent, call 112 or your local emergency number now.')}</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void talk.run(async () => {
                const sent = await caregiverTalk(current.linkId, message);
                setReply(sent.message);
                setMessage('');
              }, t('Your request was sent.'));
            }}
          >
            <Feedback error={talk.error} />
            <Field label={t('Message (optional)')}>
              <textarea rows={3} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} />
            </Field>
            <button className="btn-primary" disabled={talk.busy}>{t('Ask someone to get back to me')}</button>
          </form>
          {reply && <p role="status" className="continuity-success">{reply}</p>}
        </Panel>
      </section>

      <Panel title={t('Looking after someone else too?')}>
        <p>{t('If another woman has invited you, enter her invite code.')}</p>
        <JoinForm />
      </Panel>

      <StopHelpingCard linkId={current.linkId} womanName={current.womanName} />
    </Page>
  );
}
