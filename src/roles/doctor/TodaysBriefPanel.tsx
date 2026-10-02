import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Clock3, ListChecks, MessageCircle, Calendar, FileCheck2, Stethoscope } from 'lucide-react';
import { fetchTodaysBrief, markBriefReviewed } from '../../api/doctorPortal';
import type { TodaysBrief } from '../../api/doctorPortal';
import { StatusBadge } from '../../components/StatusBadge';
import { formatFriendlyDate, formatFriendlyDateTime, formatFriendlyTime } from './format';

const NOT_AVAILABLE = 'Not available in current records.';

interface Props {
  episodeId: string;
}

export function TodaysBriefPanel({ episodeId }: Props) {
  const navigate = useNavigate();
  const [brief, setBrief] = useState<TodaysBrief | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    fetchTodaysBrief(episodeId)
      .then(setBrief)
      .catch(() => setError("We couldn't load Today's Brief for this patient."))
      .finally(() => setIsLoading(false));
  }, [episodeId]);

  const handleStartConsultation = async () => {
    try { await markBriefReviewed(episodeId); } catch { /* non-critical */ }
    navigate(`/doctor/consultations?episodeId=${episodeId}`);
  };

  if (isLoading) return <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading Today's Brief…</div>;
  if (error || !brief) return <div className="glass-panel" style={{ padding: '24px', color: 'var(--rose-urgent)', textAlign: 'center' }}>{error}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="glass-panel" style={{ padding: '20px 24px', border: '1px solid var(--emerald-raw-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={18} style={{ color: 'var(--teal-primary)' }} />
            <span className="page-title" style={{ fontSize: '1.1rem' }}>{brief.patientName}</span>
          </div>
          <StatusBadge label={brief.status === 'REVIEWED' ? 'Reviewed' : 'Draft'} tone={brief.status === 'REVIEWED' ? 'green' : 'purple'} />
        </div>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
          <span>{brief.age != null ? `Age ${brief.age}` : 'Age not recorded'}</span>
          <span>GA {brief.gestationalAgeWeeks}w{brief.gestationalAgeDays}d</span>
          <span>EDD: {formatFriendlyDate(brief.edd)}</span>
          <span>Risk: {brief.riskCategory.replace('_', ' ')}</span>
        </div>
      </div>

      <BriefSection icon={<Clock3 size={16} />} title="Recent Events">
        {brief.recentEvents.length === 0 ? (
          <Empty text={NOT_AVAILABLE} />
        ) : (
          brief.recentEvents.slice(0, 5).map((e) => (
            <div key={e.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)' }}>{formatFriendlyDate(e.eventDate)}</div>
              <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)' }}>{e.title}</div>
            </div>
          ))
        )}
      </BriefSection>

      <BriefSection icon={<ListChecks size={16} />} title="Pending Items">
        {brief.pendingItems.length === 0 ? <Empty text="No outstanding tasks or follow-ups." /> : (
          brief.pendingItems.map((t) => (
            <div key={t.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.86rem', color: 'var(--text-primary)' }}>
              {t.title}{t.dueDate && <span style={{ color: 'var(--text-muted)' }}> · Due {formatFriendlyDate(t.dueDate)}</span>}
            </div>
          ))
        )}
      </BriefSection>

      <BriefSection icon={<MessageCircle size={16} />} title="Patient Questions">
        {brief.patientQuestions.length === 0 ? <Empty text="No unanswered questions." /> : (
          brief.patientQuestions.map((q) => (
            <div key={q.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.86rem', color: 'var(--text-primary)' }}>
              {q.questionText}
            </div>
          ))
        )}
      </BriefSection>

      <BriefSection icon={<Calendar size={16} />} title="Upcoming">
        {brief.nextAppointment ? (
          <div style={{ fontSize: '0.86rem', color: 'var(--text-primary)' }}>
            {formatFriendlyDate(brief.nextAppointment.scheduledAt)} · {formatFriendlyTime(brief.nextAppointment.scheduledAt)} — {brief.nextAppointment.appointmentType}
          </div>
        ) : <Empty text={NOT_AVAILABLE} />}
      </BriefSection>

      <BriefSection icon={<FileCheck2 size={16} />} title="Latest Approved Information">
        <div style={{ fontSize: '0.86rem', color: 'var(--text-primary)' }}>{brief.latestApprovedInfo}</div>
      </BriefSection>

      <BriefSection icon={<FileCheck2 size={16} />} title="Relevant Documents">
        {brief.relevantDocuments.length === 0 ? <Empty text={NOT_AVAILABLE} /> : (
          brief.relevantDocuments.map((d) => (
            <div key={d.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.86rem', color: 'var(--text-primary)' }}>{d.filename}</span>
              <StatusBadge label={d.statusLabel} tone="green" />
            </div>
          ))
        )}
      </BriefSection>

      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Generated {formatFriendlyDateTime(brief.generatedAt)}</div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button onClick={handleStartConsultation} className="btn-primary"><Stethoscope size={15} /> Start Consultation</button>
        <button onClick={() => navigate(`/doctor/patients/${episodeId}`)} className="btn-secondary">View Full Journey</button>
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
