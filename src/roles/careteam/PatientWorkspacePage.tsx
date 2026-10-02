import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';
import {
  fetchEpisode, fetchEpisodeJourney, fetchDocuments, fetchQuestions, fetchTasks, fetchReferrals,
} from '../../api/careTeamPortal';
import type { EpisodeDetail, JourneyEvent, CareTeamDocument, CareTeamQuestion, Task, Referral } from '../../api/careTeamPortal';
import { StatusBadge } from '../../components/StatusBadge';
import { formatFriendlyDate } from './format';
import { DOCUMENT_STATUS_TONE, QUESTION_STATUS_TONE, TASK_STATUS_TONE, REFERRAL_STATUS_TONE, friendlyQuestionStatus, friendlyTaskStatus, friendlyReferralStatus } from './format';
import { UploadDocumentFallbackModal } from './UploadDocumentFallbackModal';
import { AddTaskModal } from './AddTaskModal';
import { AddQuestionModal } from './AddQuestionModal';

type Tab = 'journey' | 'documents' | 'questions' | 'tasks' | 'referrals';

export function PatientWorkspacePage() {
  const { episodeId } = useParams<{ episodeId: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('journey');
  const [episode, setEpisode] = useState<EpisodeDetail | null>(null);
  const [journey, setJourney] = useState<JourneyEvent[]>([]);
  const [documents, setDocuments] = useState<CareTeamDocument[]>([]);
  const [questions, setQuestions] = useState<CareTeamQuestion[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<'upload' | 'task' | 'question' | null>(null);

  const loadAll = (id: string) => {
    setIsLoading(true);
    Promise.all([
      fetchEpisode(id), fetchEpisodeJourney(id), fetchDocuments({ episodeId: id }),
      fetchQuestions(id), fetchTasks({ episodeId: id }), fetchReferrals({ episodeId: id }),
    ])
      .then(([ep, j, d, q, t, r]) => {
        setEpisode(ep); setJourney(j); setDocuments(d); setQuestions(q); setTasks(t); setReferrals(r);
      })
      .catch(() => setError("We couldn't load this patient. You may not be assigned to them."))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { if (episodeId) loadAll(episodeId); }, [episodeId]);

  if (!episodeId) return null;

  const refresh = () => loadAll(episodeId);

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'journey', label: 'Journey' },
    { key: 'documents', label: 'Documents', count: documents.length },
    { key: 'questions', label: 'Questions', count: questions.length },
    { key: 'tasks', label: 'Tasks', count: tasks.length },
    { key: 'referrals', label: 'Referrals', count: referrals.length },
  ];

  return (
    <main style={{ padding: '24px', flex: 1, maxWidth: '980px', margin: '0 auto', width: '100%' }}>
      <button
        onClick={() => navigate('/care-team/patients')}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: 'var(--teal-primary)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, padding: 0, marginBottom: '14px' }}
      >
        <ArrowLeft size={15} /> Back to Patients
      </button>

      {isLoading && (
        <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading patient workspace…</div>
      )}
      {error && !isLoading && (
        <div className="glass-panel" style={{ padding: '24px', color: 'var(--rose-urgent)', textAlign: 'center' }}>{error}</div>
      )}

      {episode && !isLoading && (
        <>
          <div className="glass-panel" style={{ padding: '18px 22px', marginBottom: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div className="page-title" style={{ fontSize: '1.25rem' }}>{episode.patientName}</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {episode.age != null ? `Age ${episode.age}` : 'Age not recorded'} · EDD: {formatFriendlyDate(episode.edd)} · GA {episode.gestationalAgeWeeks}w{episode.gestationalAgeDays}d
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button onClick={() => setModal('upload')} className="btn-secondary" style={{ fontSize: '0.8rem' }}>
                <Plus size={14} /> Upload Document
              </button>
              <button onClick={() => setModal('task')} className="btn-secondary" style={{ fontSize: '0.8rem' }}>
                <Plus size={14} /> Add Task
              </button>
              <button onClick={() => setModal('question')} className="btn-secondary" style={{ fontSize: '0.8rem' }}>
                <Plus size={14} /> Add Question
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', font: 'inherit',
                  fontSize: '0.85rem', fontWeight: tab === t.key ? 700 : 500,
                  color: tab === t.key ? 'var(--teal-primary)' : 'var(--text-secondary)',
                  borderBottom: tab === t.key ? '2px solid var(--teal-primary)' : '2px solid transparent',
                  marginBottom: '-1px',
                }}
              >
                {t.label}{t.count !== undefined ? ` (${t.count})` : ''}
              </button>
            ))}
          </div>

          {tab === 'journey' && (
            journey.length === 0 ? (
              <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>No journey events recorded yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {journey.map((e) => (
                  <div key={e.id} className="glass-panel" style={{ padding: '14px 18px' }}>
                    <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)' }}>{formatFriendlyDate(e.eventDate)}</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>{e.title}</div>
                    {e.summary && <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '3px' }}>{e.summary}</div>}
                  </div>
                ))}
              </div>
            )
          )}

          {tab === 'documents' && (
            documents.length === 0 ? (
              <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>No documents yet.</div>
            ) : (
              <div className="glass-panel" style={{ padding: '4px 0' }}>
                {documents.map((d, i) => (
                  <button
                    key={d.id}
                    onClick={() => navigate(`/care-team/documents/${d.id}`)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', width: '100%', padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', textAlign: 'left', borderBottom: i === documents.length - 1 ? 'none' : '1px solid var(--border-color)' }}
                  >
                    <span>
                      <span style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{d.filename}</span>
                      <span style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-muted)' }}>Uploaded by {d.uploadedByName} · {formatFriendlyDate(d.uploadedAt)}</span>
                    </span>
                    <StatusBadge label={d.statusLabel} tone={DOCUMENT_STATUS_TONE[d.status]} />
                  </button>
                ))}
              </div>
            )
          )}

          {tab === 'questions' && (
            questions.length === 0 ? (
              <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>No questions yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {questions.map((q) => (
                  <div key={q.id} className="glass-panel" style={{ padding: '14px 18px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                    <div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{q.questionText}</div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '3px' }}>{formatFriendlyDate(q.createdAt)}</div>
                    </div>
                    <StatusBadge label={friendlyQuestionStatus(q.status)} tone={QUESTION_STATUS_TONE[q.status]} />
                  </div>
                ))}
              </div>
            )
          )}

          {tab === 'tasks' && (
            tasks.length === 0 ? (
              <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>No tasks yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {tasks.map((t) => (
                  <div key={t.id} className="glass-panel" style={{ padding: '14px 18px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                    <div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{t.title}</div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                        Owner: {t.ownerName ?? 'Unassigned'}{t.dueDate && <> · Due {formatFriendlyDate(t.dueDate)}</>}
                      </div>
                    </div>
                    <StatusBadge label={friendlyTaskStatus(t.status)} tone={TASK_STATUS_TONE[t.status]} />
                  </div>
                ))}
              </div>
            )
          )}

          {tab === 'referrals' && (
            referrals.length === 0 ? (
              <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>No referrals yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {referrals.map((r) => (
                  <div key={r.id} className="glass-panel" style={{ padding: '14px 18px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                    <div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{r.title}</div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                        {r.referredTo ?? 'Referred to: not specified'} · Owner: {r.ownerName ?? 'Unassigned'}
                      </div>
                    </div>
                    <StatusBadge label={friendlyReferralStatus(r.status)} tone={REFERRAL_STATUS_TONE[r.status]} />
                  </div>
                ))}
              </div>
            )
          )}

          {modal === 'upload' && (
            <UploadDocumentFallbackModal episodeId={episodeId} onClose={() => setModal(null)} onUploaded={() => { setModal(null); refresh(); }} />
          )}
          {modal === 'task' && (
            <AddTaskModal episodeId={episodeId} onClose={() => setModal(null)} onCreated={() => { setModal(null); refresh(); }} />
          )}
          {modal === 'question' && (
            <AddQuestionModal episodeId={episodeId} onClose={() => setModal(null)} onCreated={() => { setModal(null); refresh(); }} />
          )}
        </>
      )}
    </main>
  );
}
