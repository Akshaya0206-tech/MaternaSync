import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Stethoscope, Eye, CheckCircle2, XCircle } from 'lucide-react';
import {
  fetchEpisode, fetchEpisodeJourney, fetchDocuments, fetchQuestions, fetchFollowUps, fetchHandover,
  verifyDocument, rejectDocument, documentFileUrl, markBriefReviewed,
} from '../../api/doctorPortal';
import type { EpisodeDetail } from '../../api/careTeamPortal';
import type { JourneyEvent, CareTeamDocument, CareTeamQuestion, Task, Handover } from '../../api/doctorPortal';
import { fetchBlobWithAuth, ApiError } from '../../api/client';
import { StatusBadge } from '../../components/StatusBadge';
import { formatFriendlyDate } from './format';
import { DOCUMENT_STATUS_TONE, QUESTION_STATUS_TONE, TASK_STATUS_TONE, friendlyQuestionStatus, friendlyTaskStatus } from './format';
import { TodaysBriefPanel } from './TodaysBriefPanel';

type Tab = 'brief' | 'journey' | 'documents' | 'consultations' | 'questions' | 'followups' | 'handover';

export function PatientWorkspacePage() {
  const { episodeId } = useParams<{ episodeId: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('brief');
  const [episode, setEpisode] = useState<EpisodeDetail | null>(null);
  const [journey, setJourney] = useState<JourneyEvent[]>([]);
  const [documents, setDocuments] = useState<CareTeamDocument[]>([]);
  const [questions, setQuestions] = useState<CareTeamQuestion[]>([]);
  const [followUps, setFollowUps] = useState<Task[]>([]);
  const [handover, setHandover] = useState<Handover | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadAll = (id: string) => {
    setIsLoading(true);
    Promise.all([
      fetchEpisode(id), fetchEpisodeJourney(id), fetchDocuments({ episodeId: id }),
      fetchQuestions().then((qs) => qs.filter((q) => q.episodeId === id)),
      fetchFollowUps().then((ts) => ts.filter((t) => t.episodeId === id)),
      fetchHandover(id),
    ])
      .then(([ep, j, d, q, t, h]) => {
        setEpisode(ep); setJourney(j); setDocuments(d); setQuestions(q); setFollowUps(t); setHandover(h);
      })
      .catch(() => setError("We couldn't load this patient. You may not be assigned to them."))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { if (episodeId) loadAll(episodeId); }, [episodeId]);

  if (!episodeId) return null;

  const refresh = () => loadAll(episodeId);

  const handleStartConsultation = async () => {
    try { await markBriefReviewed(episodeId); } catch { /* non-critical */ }
    navigate(`/doctor/consultations?episodeId=${episodeId}`);
  };

  const handleViewOriginal = async (docId: string) => {
    try {
      const blob = await fetchBlobWithAuth(documentFileUrl(docId));
      window.open(URL.createObjectURL(blob), '_blank');
    } catch {
      setNotice('The original file for this document is not available.');
      window.setTimeout(() => setNotice(null), 4000);
    }
  };

  const handleVerify = async (docId: string) => {
    try { await verifyDocument(docId); refresh(); } catch (err) { setNotice(err instanceof ApiError ? err.message : 'Could not verify this document.'); }
  };

  const handleReject = async (docId: string) => {
    try { await rejectDocument(docId); refresh(); } catch (err) { setNotice(err instanceof ApiError ? err.message : 'Could not reject this document.'); }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'brief', label: "Today's Brief" },
    { key: 'journey', label: 'Journey' },
    { key: 'documents', label: 'Documents' },
    { key: 'consultations', label: 'Consultations' },
    { key: 'questions', label: 'Questions' },
    { key: 'followups', label: 'Follow-ups' },
    { key: 'handover', label: 'Handover' },
  ];

  return (
    <main style={{ padding: '24px', flex: 1, maxWidth: '980px', margin: '0 auto', width: '100%' }}>
      <button
        onClick={() => navigate('/doctor/patients')}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: 'var(--teal-primary)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, padding: 0, marginBottom: '14px' }}
      >
        <ArrowLeft size={15} /> Back to My Patients
      </button>

      {isLoading && <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading patient workspace…</div>}
      {error && !isLoading && <div className="glass-panel" style={{ padding: '24px', color: 'var(--rose-urgent)', textAlign: 'center' }}>{error}</div>}

      {episode && !isLoading && (
        <>
          <div className="glass-panel" style={{ padding: '18px 22px', marginBottom: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div className="page-title" style={{ fontSize: '1.25rem' }}>{episode.patientName}</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {episode.age != null ? `Age ${episode.age}` : 'Age not recorded'} · EDD: {formatFriendlyDate(episode.edd)} · GA {episode.gestationalAgeWeeks}w{episode.gestationalAgeDays}d
              </div>
            </div>
            <button onClick={handleStartConsultation} className="btn-primary"><Stethoscope size={15} /> Start Consultation</button>
          </div>

          {notice && <div className="glass-panel" style={{ padding: '10px 16px', marginBottom: '14px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{notice}</div>}

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
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'brief' && <TodaysBriefPanel episodeId={episodeId} />}

          {tab === 'journey' && (
            journey.length === 0 ? (
              <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>No journey events recorded yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {journey.map((e) => (
                  <div key={e.id} className="glass-panel" style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)' }}>{formatFriendlyDate(e.eventDate)}</div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{e.eventType}</span>
                    </div>
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
                  <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '14px 20px', borderBottom: i === documents.length - 1 ? 'none' : '1px solid var(--border-color)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{d.filename}</div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Uploaded by {d.uploadedByName}</div>
                    </div>
                    <StatusBadge label={d.statusLabel} tone={DOCUMENT_STATUS_TONE[d.status]} />
                    <button onClick={() => handleViewOriginal(d.id)} title="View original" style={{ background: 'none', border: 'none', color: 'var(--teal-primary)', cursor: 'pointer', display: 'flex' }}>
                      <Eye size={16} />
                    </button>
                    {d.status === 'NEEDS_REVIEW' && (
                      <>
                        <button onClick={() => handleVerify(d.id)} title="Verify" style={{ background: 'none', border: 'none', color: 'var(--emerald-raw)', cursor: 'pointer', display: 'flex' }}>
                          <CheckCircle2 size={16} />
                        </button>
                        <button onClick={() => handleReject(d.id)} title="Reject" style={{ background: 'none', border: 'none', color: 'var(--rose-urgent)', cursor: 'pointer', display: 'flex' }}>
                          <XCircle size={16} />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )
          )}

          {tab === 'consultations' && (
            <div className="glass-panel" style={{ padding: '32px', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '14px' }}>Start or continue a consultation for this patient.</p>
              <button onClick={handleStartConsultation} className="btn-primary"><Stethoscope size={15} /> Start Consultation</button>
            </div>
          )}

          {tab === 'questions' && (
            questions.length === 0 ? (
              <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>No questions for this patient.</div>
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

          {tab === 'followups' && (
            followUps.length === 0 ? (
              <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>No follow-ups for this patient.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {followUps.map((t) => (
                  <div key={t.id} className="glass-panel" style={{ padding: '14px 18px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                    <div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{t.title}</div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '3px' }}>{t.dueDate && <>Due {formatFriendlyDate(t.dueDate)}</>}</div>
                    </div>
                    <StatusBadge label={friendlyTaskStatus(t.status)} tone={TASK_STATUS_TONE[t.status]} />
                  </div>
                ))}
              </div>
            )
          )}

          {tab === 'handover' && (
            handover ? (
              <div className="glass-panel" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <StatusBadge label={handover.status === 'DRAFT' ? 'AI-Generated Draft' : 'Final · Shared Internally'} tone={handover.status === 'DRAFT' ? 'purple' : 'green'} />
                <HandoverField label="Context" value={handover.context} />
                <HandoverField label="What Happened" value={handover.whatHappened} />
                <HandoverField label="What Remains" value={handover.whatRemains} />
                <HandoverField label="Who Owns It" value={handover.whoOwnsIt} />
                <HandoverField label="What to Discuss" value={handover.whatToDiscuss} />
                <button onClick={() => navigate('/doctor/handover')} className="btn-secondary" style={{ alignSelf: 'flex-start', fontSize: '0.8rem' }}>Edit in Handover</button>
              </div>
            ) : (
              <div className="glass-panel" style={{ padding: '32px', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '14px' }}>No handover exists yet for this patient.</p>
                <button onClick={() => navigate('/doctor/handover')} className="btn-primary">Go to Handover</button>
              </div>
            )
          )}
        </>
      )}
    </main>
  );
}

function HandoverField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '0.86rem', color: 'var(--text-primary)', marginTop: '2px' }}>{value}</div>
    </div>
  );
}
