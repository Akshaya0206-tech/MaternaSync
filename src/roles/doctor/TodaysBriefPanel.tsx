import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Clock3, ListChecks, MessageCircle, Calendar, FileCheck2, Stethoscope } from 'lucide-react';
import { fetchTodaysBrief, markBriefReviewed } from '../../api/doctorPortal';
import type { TodaysBrief } from '../../api/doctorPortal';
import { StatusBadge } from '../../components/StatusBadge';
import { formatFriendlyDate, formatFriendlyDateTime, formatFriendlyTime } from './format';
import { Link } from 'react-router-dom';
import { TrendsPanel } from '../../components/continuity/TrendsPanel';
import { tx, useLanguage } from '../../i18n';

const NOT_AVAILABLE = tx('Not available in current records.');

interface Props {
  episodeId: string;
}

export function TodaysBriefPanel({ episodeId }: Props) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [brief, setBrief] = useState<TodaysBrief | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    fetchTodaysBrief(episodeId)
      .then(setBrief)
      .catch(() => setError(tx("We couldn't load Today's Brief for this patient.")))
      .finally(() => setIsLoading(false));
  }, [episodeId]);

  const handleStartConsultation = async () => {
    try { await markBriefReviewed(episodeId); } catch { /* non-critical */ }
    navigate(`/doctor/consultations?episodeId=${episodeId}`);
  };

  if (isLoading) return <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>{t("Loading Today's Brief…")}</div>;
  if (error || !brief) return <div className="glass-panel" style={{ padding: '24px', color: 'var(--rose-urgent)', textAlign: 'center' }}>{error && t(error)}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="glass-panel" style={{ padding: '20px 24px', border: '1px solid var(--emerald-raw-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={18} style={{ color: 'var(--teal-primary)' }} />
            <span className="page-title" style={{ fontSize: '1.1rem' }}>{brief.patientName}</span>
          </div>
          <StatusBadge label={brief.status === 'REVIEWED' ? t('Reviewed') : t('Draft')} tone={brief.status === 'REVIEWED' ? 'green' : 'purple'} />
        </div>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
          <span>{brief.age != null ? t('Age {age}', { age: brief.age }) : t('Age not recorded')}</span>
          <span>GA {brief.gestationalAgeWeeks}w{brief.gestationalAgeDays}d</span>
          <span>EDD: {formatFriendlyDate(brief.edd)}</span>
        </div>
      </div>

      <BriefSection icon={<Clock3 size={16} />} title={t('Recent Events')}>
        {brief.recentEvents.length === 0 ? (
          <Empty text={t(NOT_AVAILABLE)} />
        ) : (
          brief.recentEvents.slice(0, 5).map((e) => (
            <div key={e.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)' }}>{formatFriendlyDate(e.eventDate)}</div>
              <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)' }}>{t(e.title)}</div>
            </div>
          ))
        )}
      </BriefSection>

      <BriefSection icon={<ListChecks size={16} />} title={t('Pending Items')}>
        {brief.pendingItems.length === 0 ? <Empty text={t('No outstanding tasks or follow-ups.')} /> : (
          brief.pendingItems.map((task) => (
            <div key={task.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.86rem', color: 'var(--text-primary)' }}>
              <Link to={`/doctor/care-workspace?episodeId=${episodeId}`}>{task.title}</Link>{task.dueDate && <span style={{ color: 'var(--text-muted)' }}> · {t('Due {date}', { date: formatFriendlyDate(task.dueDate) })}</span>}
              <span style={{ display: 'block', color: 'var(--text-muted)' }}>{t('Owner: {name}', { name: task.ownerName || t('Unassigned') })}</span>
            </div>
          ))
        )}
      </BriefSection>

      <BriefSection icon={<MessageCircle size={16} />} title={t('Patient Questions')}>
        {brief.patientQuestions.length === 0 ? <Empty text={t('No unanswered questions.')} /> : (
          brief.patientQuestions.map((q) => (
            <div key={q.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.86rem', color: 'var(--text-primary)' }}>
              <Link to="/doctor/questions">{q.questionText}</Link>
            </div>
          ))
        )}
      </BriefSection>

      <BriefSection icon={<Calendar size={16} />} title={t('Upcoming')}>
        {brief.nextAppointment ? (
          <div style={{ fontSize: '0.86rem', color: 'var(--text-primary)' }}>
            {formatFriendlyDate(brief.nextAppointment.scheduledAt)} · {formatFriendlyTime(brief.nextAppointment.scheduledAt)} — {brief.nextAppointment.appointmentType}
          </div>
        ) : <Empty text={t(NOT_AVAILABLE)} />}
      </BriefSection>

      <BriefSection icon={<FileCheck2 size={16} />} title={t('Latest Approved Information')}>
        <div style={{ fontSize: '0.86rem', color: 'var(--text-primary)' }}>{t(brief.latestApprovedInfo)}</div>
      </BriefSection>

      <BriefSection icon={<FileCheck2 size={16} />} title={t('Relevant Documents')}>
        {brief.relevantDocuments.length === 0 ? <Empty text={t(NOT_AVAILABLE)} /> : (
          brief.relevantDocuments.map((d) => (
            <div key={d.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.86rem', color: 'var(--text-primary)' }}>{d.filename}</span>
              <StatusBadge label={t(d.statusLabel)} tone="green" />
            </div>
          ))
        )}
      </BriefSection>

      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{t('Generated {date}', { date: formatFriendlyDateTime(brief.generatedAt) })}</div>

      <TrendsPanel episodeId={episodeId} />

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button onClick={handleStartConsultation} className="btn-primary"><Stethoscope size={15} /> {t('Start Consultation')}</button>
        <button onClick={() => navigate(`/doctor/patients/${episodeId}`)} className="btn-secondary">{t('View Full Journey')}</button>
      </div>
    </div>
  );
}

function BriefSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="glass-panel" style={{ padding: '16px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <span style={{ color: 'var(--teal-primary)' }}>{icon}</span>
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{text}</div>;
}
