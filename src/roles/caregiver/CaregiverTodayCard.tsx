import { Link } from 'react-router-dom';
import { BellRing, CalendarClock, ClipboardCheck, MessageSquareReply } from 'lucide-react';
import type { ReactNode } from 'react';
import { caregiverToday } from '../../api/caregiverHome';
import type { CaregiverToday } from '../../api/caregiverHome';
import { useLanguage } from '../../i18n';
import { formatFriendlyDate, formatFriendlyTime } from '../patient/format';
import { useCaregiver } from './CaregiverContext';
import { useForWoman } from './useForWoman';

function Row({ icon, text, to, action, last }: { icon: ReactNode; text: string; to?: string; action?: string; last?: boolean }) {
  return (
    <div className={`today-row${last ? ' today-row-last' : ''}`}>
      <span className="today-icon" aria-hidden="true">{icon}</span>
      <p>{text}</p>
      {to && action && <Link className="btn-secondary" to={to}>{action}</Link>}
    </div>
  );
}

/** Today at a glance, at the top of Home, like the one on her own Home page. Each line appears only if she has allowed that part (the server
 *  does not send the others), shows counts and times only, and leads to the page it is about. With nothing allowed, there is no card. */
export function CaregiverTodayCard() {
  const { t } = useLanguage();
  const { current } = useCaregiver();
  const today = useForWoman<CaregiverToday>(caregiverToday, !current?.ended);
  const data = today.data;
  if (!data || !current) return null;
  const first = current.womanName.split(' ')[0];

  const rows: { key: string; icon: ReactNode; text: string; to?: string; action?: string }[] = [];
  if (data.checkIn !== undefined) {
    rows.push({
      key: 'check-in',
      icon: <ClipboardCheck size={18} />,
      text: data.checkIn === 'recorded'
        ? t('{name}’s check-in for today is saved.', { name: first })
        : data.checkIn === 'skipped'
          ? t('{name} skipped today’s check-in. It can still be filled in.', { name: first })
          : t('{name}’s check-in for today has not been filled in yet.', { name: first }),
      to: data.checkIn === 'recorded' ? undefined : '/caregiver/check-in/new',
      action: t('Fill in a check-in with her'),
    });
  }
  if (data.remindersDue !== undefined) {
    rows.push({
      key: 'reminders',
      icon: <BellRing size={18} />,
      text: data.remindersDue > 0
        ? t('Reminders waiting for {name}’s answer: {count}', { name: first, count: data.remindersDue })
        : t('No reminders are waiting for {name}’s answer.', { name: first }),
      to: data.remindersDue > 0 ? '/caregiver/reminders' : undefined,
      action: t('See her reminders'),
    });
  }
  if (data.answeredRecently !== undefined) {
    rows.push({
      key: 'answers',
      icon: <MessageSquareReply size={18} />,
      text: data.answeredRecently > 0
        ? t('The doctor has answered {count} of your questions in the last 7 days.', { count: data.answeredRecently })
        : t('No new answers to your questions in the last 7 days.'),
      to: data.answeredRecently > 0 ? '/caregiver/questions' : undefined,
      action: t('Read the answers'),
    });
  }
  if (data.nextVisit !== undefined) {
    const visit = data.nextVisit;
    rows.push({
      key: 'visit',
      icon: <CalendarClock size={18} />,
      text: visit
        ? t('Next visit: {when}', { when: `${formatFriendlyDate(visit.scheduledAt)} · ${formatFriendlyTime(visit.scheduledAt)} · ${visit.type}${visit.location ? ` · ${visit.location}` : ''}` })
        : t('No upcoming visit is recorded.'),
      to: visit ? '/caregiver/appointments' : undefined,
      action: t('Appointments'),
    });
  }
  if (!rows.length) return null;

  return (
    <section className="glass-panel today-card" aria-labelledby="cg-today-heading">
      <h2 id="cg-today-heading">{t('Today')}</h2>
      {rows.map((row, index) => <Row key={row.key} icon={row.icon} text={row.text} to={row.to} action={row.action} last={index === rows.length - 1} />)}
    </section>
  );
}
