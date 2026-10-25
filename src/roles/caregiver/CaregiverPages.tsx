import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Phone } from 'lucide-react';
import {
  acceptInvite, askCaregiverQuestion, caregiverAppointments, caregiverCarePlan, caregiverCheckIns, caregiverEmergency, caregiverHome,
  caregiverNotifications, caregiverQuestions, caregiverTalk, saveCaregiverCheckIn,
} from '../../api/caregiver';
import type { CaregiverAppointment, CaregiverCheckIn, CaregiverEmergency, CaregiverNotification, CaregiverQuestion, HomeSummary, Permission } from '../../api/caregiver';
import type { Workspace } from '../../api/continuity';
import { formatTime } from '../../api/continuity';
import { useAuth } from '../../auth/AuthContext';
import { tx, useLanguage } from '../../i18n';
import { Badge, Empty, Feedback, Field, Page, Panel, useAction } from '../../components/continuity/shared';
import { formatFriendlyDate, friendlyAppointmentStatus, friendlyQuestionStatus } from '../patient/format';
import { GuidedCheckInForm } from '../patient/GuidedCheckInForm';
import { SummaryList } from '../patient/SupportPages';
import { CaregiverWhatsAppCard } from './CaregiverWhatsApp';
import { useCaregiver } from './CaregiverContext';
import { VisitHelper } from './VisitHelper';

// What each permission lets a trusted person do, in the words she sees when she chooses (the same words are used on her side).
const PERMISSION_TEXT: Record<Permission, string> = {
  appointments: tx('See her appointments'),
  check_in: tx('See her daily check-ins and fill one in with her'),
  care_plan: tx('Read the summaries and instructions her doctor has released to her'),
  questions: tx('Ask the clinic a question, and read the replies'),
  emergency: tx('See her emergency numbers, her emergency contact and her preferred hospital'),
};

/** Loads something for the woman being looked after, again whenever the choice changes. */
function useForWoman<T>(load: (linkId: string) => Promise<T>, allowed = true) {
  const { current } = useCaregiver();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const linkId = current?.linkId;
  const reload = useCallback(async () => {
    if (!linkId || !allowed) return;
    try {
      setData(await load(linkId));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not load this page. Please try again.');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkId, allowed]);
  useEffect(() => {
    setData(null);
    setLoading(true);
    void reload();
  }, [reload]);
  return { data, error, loading, reload };
}

/** Shown instead of a page when the end date she set has passed. The server refuses the requests too; this explains why. */
function EndedNotice({ title }: { title: string }) {
  const { t } = useLanguage();
  const { current } = useCaregiver();
  return (
    <Page title={title}>
      <Panel title={t('Your access has ended')}>
        <p>{t('{name} set an end date for your access, and it has passed ({date}). Ask her to extend it from her Profile page. Nothing about her is shown until she does.', { name: current?.womanName ?? '', date: formatFriendlyDate(current?.accessUntil) })}</p>
        <p className="continuity-muted">{t('If you look after someone else too, choose her from the menu.')}</p>
      </Panel>
    </Page>
  );
}

/** Wraps a page that needs a permission: shows a plain explanation, not an error, if she has not allowed it. */
function Needs({ permission, title, children }: { permission: Permission; title: string; children: (linkId: string) => ReactNode }) {
  const { t } = useLanguage();
  const { women, current, can } = useCaregiver();
  if (women === null) return <Page title={title}><p role="status" className="continuity-muted">{t('Loading…')}</p></Page>;
  if (!current) return <NotLinked title={title} />;
  if (current.ended) return <EndedNotice title={title} />;
  if (!can(permission)) {
    return (
      <Page title={title}>
        <Panel title={t('She has not allowed this')}>
          <p>{t('{name} has not allowed you to use this page. You can ask her to change it if you need it.', { name: current.womanName })}</p>
          <Link className="btn-secondary" to="/caregiver/home">{t('Back to Home')}</Link>
        </Panel>
      </Page>
    );
  }
  return <>{children(current.linkId)}</>;
}

function JoinForm() {
  const { t } = useLanguage();
  const { reload, select } = useCaregiver();
  const action = useAction();
  const [code, setCode] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void action.run(async () => {
          const joined = await acceptInvite(code);
          setCode('');
          await reload();
          select(joined.linkId);
        }, t('You can now see what she has allowed.'));
      }}
    >
      <Feedback error={action.error} message={action.message} />
      <Field label={t('Invite code')}>
        <input required value={code} onChange={(e) => setCode(e.target.value)} placeholder="ABCD-2345" autoComplete="off" autoCapitalize="characters" spellCheck={false} />
      </Field>
      <button className="btn-primary" disabled={action.busy}>{t('Join')}</button>
    </form>
  );
}

function NotLinked({ title }: { title: string }) {
  const { t } = useLanguage();
  return (
    <Page title={title}>
      <Panel title={t('You are not looking after anyone right now')}>
        <p>{t('A woman can remove you at any time. If she has made you a new invite, enter its code here.')}</p>
        <JoinForm />
      </Panel>
    </Page>
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
      <Panel title={t('You are helping {name}', { name: current.womanName })}>
        <p>{current.relationship ? t('You are listed as: {relationship}.', { relationship: current.relationship }) : t('You are one of her trusted people.')}</p>
        {current.accessUntil && <p className="continuity-note" role="status">{t('Your access ends on {date}. {name} can extend it.', { date: formatFriendlyDate(current.accessUntil), name: current.womanName.split(' ')[0] })}</p>}
        <ul className="continuity-list">
          {(Object.keys(PERMISSION_TEXT) as Permission[]).map((permission) => (
            <li key={permission}>
              <Badge>{current.permissions[permission] ? t('Allowed') : t('Not allowed')}</Badge> {t(PERMISSION_TEXT[permission])}
            </li>
          ))}
        </ul>
        <p className="continuity-muted">{t('You never see her records, medicines, results or documents unless she has allowed it above, and her doctor’s notes are never shown here.')}</p>
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

      {current.permissions.check_in && data && (
        <Panel title={t('Daily check-in')}>
          <p>{data.lastCheckIn ? t('The last check-in was on {when}.', { when: formatTime(data.lastCheckIn) }) : t('No check-in has been filled in yet.')}</p>
          <Link className="btn-primary" to="/caregiver/check-in/new">{t('Fill in a check-in with her')}</Link>
        </Panel>
      )}

      <CaregiverWhatsAppCard linkId={current.linkId} womanName={current.womanName} />

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
    </Page>
  );
}

// ---------------------------------------------------------------- Appointments
export function CaregiverAppointmentsPage() {
  const { t } = useLanguage();
  return (
    <Needs permission="appointments" title={t('Appointments')}>
      {() => <Appointments />}
    </Needs>
  );
}
function Appointments() {
  const { t } = useLanguage();
  const { current } = useCaregiver();
  const list = useForWoman<CaregiverAppointment[]>(caregiverAppointments);
  return (
    <Page title={t('Appointments')} subtitle={t('Her visits to the clinic.')}>
      <Feedback error={list.error} />
      <Panel title={t('Visits')}>
        {list.loading && <p role="status" className="continuity-muted">{t('Loading…')}</p>}
        {list.data && !list.data.length && <Empty>{t('No appointments are recorded.')}</Empty>}
        {list.data?.map((a) => (
          <article key={a.id} className="continuity-item">
            <h3>{formatTime(a.scheduledAt)} <Badge>{friendlyAppointmentStatus(a.status)}</Badge></h3>
            <p>{a.type}{a.location && a.status !== 'scheduled' ? ` · ${a.location}` : ''}</p>
            {current && <VisitHelper visit={a} womanName={current.womanName} linkId={current.linkId} onChanged={() => void list.reload()} />}
          </article>
        ))}
      </Panel>
    </Page>
  );
}

// ---------------------------------------------------------------- Check-in
export function CaregiverCheckInPage() {
  const { t } = useLanguage();
  return (
    <Needs permission="check_in" title={t('Daily Check-in')}>
      {() => <CheckIns />}
    </Needs>
  );
}
function CheckIns() {
  const { t } = useLanguage();
  const list = useForWoman<CaregiverCheckIn[]>(caregiverCheckIns);
  return (
    <Page title={t('Daily Check-in')} subtitle={t('Fill in a check-in with her, one question at a time. It is saved as her check-in, with your name beside it so the clinic knows who helped.')}>
      <Feedback error={list.error} />
      <div className="continuity-actions">
        <Link className="btn-primary" to="/caregiver/check-in/new">{t('Fill in a check-in with her')}</Link>
      </div>
      <Panel title={t('Recent check-ins')}>
        {list.loading && <p role="status" className="continuity-muted">{t('Loading…')}</p>}
        {list.data && !list.data.length && <Empty>{t('No check-in has been filled in yet.')}</Empty>}
        {list.data?.filter((c) => !c.skipped).map((c) => (
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
      </Panel>
    </Page>
  );
}

export function CaregiverNewCheckInPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  return (
    <Needs permission="check_in" title={t('Daily Check-in')}>
      {(linkId) => (
        <GuidedCheckInForm
          ready
          skipWho
          filledInBy={t('You ({name}), for her', { name: user?.fullName ?? '' })}
          save={async (body) => { await saveCaregiverCheckIn(linkId, body as unknown as Record<string, unknown>); }}
          subtitle={t('One question at a time. Ask her, or read it out to her. The answers are saved as her check-in, with your name beside it.')}
          savedText={t('The check-in was saved for her care team.')}
          doneTo="/caregiver/check-in"
          doneLabel={t('Back to the check-ins')}
        />
      )}
    </Needs>
  );
}

// ---------------------------------------------------------------- Care plan
export function CaregiverCarePlanPage() {
  const { t } = useLanguage();
  return (
    <Needs permission="care_plan" title={t('Care plan')}>
      {() => <CarePlan />}
    </Needs>
  );
}
function CarePlan() {
  const { t } = useLanguage();
  const plan = useForWoman<Workspace['outputs']>(caregiverCarePlan);
  return (
    <Page title={t('Care plan')} subtitle={t('Only what her doctor has approved and released to her.')}>
      <Feedback error={plan.error} />
      <Panel title={t('Approved summaries & instructions')}>
        {plan.loading && <p role="status" className="continuity-muted">{t('Loading…')}</p>}
        {plan.data && <SummaryList data={{ outputs: plan.data, appointments: [] }} />}
      </Panel>
    </Page>
  );
}

// ---------------------------------------------------------------- Questions
export function CaregiverQuestionsPage() {
  const { t } = useLanguage();
  return (
    <Needs permission="questions" title={t('Questions')}>
      {(linkId) => <Questions linkId={linkId} />}
    </Needs>
  );
}
function Questions({ linkId }: { linkId: string }) {
  const { t } = useLanguage();
  const list = useForWoman<CaregiverQuestion[]>(caregiverQuestions);
  const action = useAction();
  const [text, setText] = useState('');
  return (
    <Page title={t('Questions')} subtitle={t('Ask the clinic a question. A person reads it, and the reply appears here once a doctor has approved it.')}>
      <Feedback error={list.error || action.error} message={action.message} />
      <Panel title={t('Ask a question')}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void action.run(async () => {
              await askCaregiverQuestion(linkId, text);
              setText('');
              await list.reload();
            }, t('Your question was sent to the clinic.'));
          }}
        >
          <Field label={t('Your question')}>
            <textarea required rows={3} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
          <p className="continuity-muted">{t('If it is an emergency, call 112 or your local emergency number instead of waiting for a reply.')}</p>
          <button className="btn-primary" disabled={action.busy || !text.trim()}>{t('Send question')}</button>
        </form>
      </Panel>
      <Panel title={t('Your questions')}>
        {list.loading && <p role="status" className="continuity-muted">{t('Loading…')}</p>}
        {list.data && !list.data.length && <Empty>{t('You have not asked any questions yet.')}</Empty>}
        {list.data?.map((q) => (
          <article key={q.id} className="continuity-item">
            <h3>{q.text} <Badge>{friendlyQuestionStatus(q.status)}</Badge></h3>
            <p className="continuity-muted">{formatTime(q.createdAt)}</p>
            {q.replies.map((r, index) => <div key={index} className="continuity-copy">{r.text}</div>)}
          </article>
        ))}
      </Panel>
    </Page>
  );
}

// ---------------------------------------------------------------- Emergency
export function CaregiverEmergencyPage() {
  const { t } = useLanguage();
  return (
    <Needs permission="emergency" title={t('Emergency help')}>
      {() => <Emergency />}
    </Needs>
  );
}
function Emergency() {
  const { t } = useLanguage();
  const info = useForWoman<CaregiverEmergency>(caregiverEmergency);
  const dial = (number: string) => `tel:${number.replace(/[^\d+]/g, '')}`;
  return (
    <Page title={t('Emergency help')} subtitle={t('If she needs urgent help, call now. These are her saved details, shown to you because she allowed it.')}>
      <Feedback error={info.error} />
      {info.data && (
        <>
          <Panel title={t('Numbers to call')} aside={<Phone size={18} aria-hidden="true" />}>
            <p className="continuity-muted">{t('Tap a number to call. If nothing happens, dial it on your phone.')}</p>
            <div className="emergency-numbers">
              {info.data.numbers.map((n) => (
                <a key={n.number} className={`emergency-call emergency-${n.kind}`} href={dial(n.number)}>
                  <strong>{n.number}</strong>
                  <span>{t(n.label)}</span>
                </a>
              ))}
            </div>
            {info.data.note && <p className="continuity-muted">{t(info.data.note)}</p>}
          </Panel>
          <Panel title={t('Her emergency contact')}>
            {info.data.contactPhone ? (
              <a className="emergency-call emergency-contact" href={dial(info.data.contactPhone)}>
                <strong>{info.data.contactName || info.data.contactPhone}</strong>
                <span>{[info.data.contactRelation, info.data.contactPhone].filter(Boolean).join(' · ')}</span>
              </a>
            ) : <Empty>{t('She has not saved an emergency contact.')}</Empty>}
          </Panel>
          <Panel title={t('Her preferred hospital')}>
            {info.data.hospitalName ? (
              <>
                <p><strong>{info.data.hospitalName}</strong>{info.data.hospitalAddress ? ` · ${info.data.hospitalAddress}` : ''}</p>
                {info.data.hospitalPhone && (
                  <a className="emergency-call emergency-contact" href={dial(info.data.hospitalPhone)}>
                    <strong>{t('Call')}</strong>
                    <span>{info.data.hospitalPhone}</span>
                  </a>
                )}
              </>
            ) : <Empty>{t('She has not saved a preferred hospital.')}</Empty>}
          </Panel>
        </>
      )}
    </Page>
  );
}

// ---------------------------------------------------------------- Updates
export function CaregiverUpdatesPage() {
  const { t } = useLanguage();
  const [items, setItems] = useState<CaregiverNotification[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    caregiverNotifications().then((n) => { if (active) setItems(n); }).catch((err) => { if (active) setError(err instanceof Error ? err.message : ''); });
    return () => { active = false; };
  }, []);
  return (
    <Page title={t('Updates')} subtitle={t('Reminders and replies for you.')}>
      <Feedback error={error} />
      <Panel title={t('Latest')}>
        {items === null && !error && <p role="status" className="continuity-muted">{t('Loading…')}</p>}
        {items && !items.length && <Empty>{t('Nothing new.')}</Empty>}
        {items?.map((n) => (
          <article key={n.id} className="continuity-item">
            <h3>{n.title}</h3>
            <p>{n.body}</p>
            <p className="continuity-muted">{formatTime(n.createdAt)}</p>
          </article>
        ))}
      </Panel>
    </Page>
  );
}
