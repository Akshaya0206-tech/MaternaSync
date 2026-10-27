import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Stethoscope, Eye, CheckCircle2, XCircle, Plus } from 'lucide-react';
import {
  fetchEpisode, fetchEpisodeJourney, fetchDocuments, fetchQuestions, fetchFollowUps, fetchHandover, fetchReferrals,
  verifyDocument, rejectDocument, documentFileUrl, markBriefReviewed,
} from '../../api/doctorPortal';
import type { EpisodeDetail } from '../../api/careTeamPortal';
import type { JourneyEvent, CareTeamDocument, CareTeamQuestion, Task, Handover, Referral } from '../../api/doctorPortal';
import { fetchBlobWithAuth, ApiError } from '../../api/client';
import { StatusBadge } from '../../components/StatusBadge';
import { formatFriendlyDate } from './format';
import { DOCUMENT_STATUS_TONE, QUESTION_STATUS_TONE, TASK_STATUS_TONE, friendlyQuestionStatus, friendlyTaskStatus } from './format';
import { TodaysBriefPanel } from './TodaysBriefPanel';
import { BriefExtras } from './BriefExtras';
import { AuditTrailPanel } from './AuditTrailPanel';
import { PatientStepper } from './PatientStepper';
import { documentTitle } from './documentTitle';
import { typeLabel } from '../patient/documentTypes';
import { CreateReferralModal } from './CreateReferralModal';
import { CareWorkspaceLink } from '../../components/continuity/CareWorkspacePage';
import { tx, useLanguage } from '../../i18n';

type Tab = 'brief' | 'journey' | 'documents' | 'consultations' | 'questions' | 'followups' | 'handover' | 'referrals' | 'audit';

// Journey event codes are shown as lower-case words (the screen capitalises them), so the keys are lower-case too.
const EVENT_TYPE_LABELS: Record<string, string> = {
  document: tx('document'),
  consultation: tx('consultation'),
  milestone: tx('milestone'),
  referral: tx('referral'),
  approved_output: tx('approved_output'),
};

// Referral status codes are shown as plain upper-case words.
const REFERRAL_STATUS_LABELS: Record<string, string> = {
  DRAFT: tx('DRAFT'),
  SENT: tx('SENT'),
  ACKNOWLEDGED: tx('ACKNOWLEDGED'),
  APPOINTMENT_SCHEDULED: tx('APPOINTMENT SCHEDULED'),
  RESPONSE_RECEIVED: tx('RESPONSE RECEIVED'),
  CLOSED: tx('CLOSED'),
};

export function PatientWorkspacePage() {
  const { t } = useLanguage();
  const { episodeId } = useParams<{ episodeId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const [tab, setTab] = useState<Tab>(
    (['brief', 'journey', 'documents', 'consultations', 'questions', 'followups', 'handover', 'referrals', 'audit'] as const).find((key) => key === requestedTab) ?? 'brief',
  );
  const [episode, setEpisode] = useState<EpisodeDetail | null>(null);
  const [journey, setJourney] = useState<JourneyEvent[]>([]);
  const [documents, setDocuments] = useState<CareTeamDocument[]>([]);
  const [questions, setQuestions] = useState<CareTeamQuestion[]>([]);
  const [followUps, setFollowUps] = useState<Task[]>([]);
  const [handover, setHandover] = useState<Handover | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isCreateReferralOpen, setIsCreateReferralOpen] = useState(false);

  const loadAll = (id: string) => {
    setIsLoading(true);
    Promise.all([
      fetchEpisode(id), fetchEpisodeJourney(id), fetchDocuments({ episodeId: id }),
      fetchQuestions().then((qs) => qs.filter((q) => q.episodeId === id)),
      fetchFollowUps().then((ts) => ts.filter((task) => task.episodeId === id)),
      fetchHandover(id), fetchReferrals(id),
    ])
      .then(([ep, j, d, q, fu, h, r]) => {
        setEpisode(ep); setJourney(j); setDocuments(d); setQuestions(q); setFollowUps(fu); setHandover(h); setReferrals(r);
      })
      .catch(() => setError(tx("We couldn't load this patient. You may not be assigned to them.")))
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
      setNotice(tx('The original file for this document is not available.'));
      window.setTimeout(() => setNotice(null), 4000);
    }
  };

  const handleVerify = async (docId: string) => {
    try { await verifyDocument(docId); refresh(); } catch (err) { setNotice(err instanceof ApiError ? err.message : tx('Could not verify this document.')); }
  };

  const handleReject = async (docId: string) => {
    try { await rejectDocument(docId); refresh(); } catch (err) { setNotice(err instanceof ApiError ? err.message : tx('Could not reject this document.')); }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'brief', label: t("Today's Brief") },
    { key: 'journey', label: t('Journey') },
    { key: 'documents', label: t('Documents') },
    { key: 'consultations', label: t('Consultations') },
    { key: 'questions', label: t('Questions') },
    { key: 'followups', label: t('Follow-ups') },
    { key: 'referrals', label: t('Referrals') },
    { key: 'handover', label: t('Handover') },
    { key: 'audit', label: t('Audit trail') },
  ];

  return (
    <main style={{ padding: '24px', flex: 1, maxWidth: '980px', margin: '0 auto', width: '100%' }}>
      <button
        onClick={() => navigate('/doctor/patients')}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: 'var(--teal-text)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, padding: 0, marginBottom: '14px' }}
      >
        <ArrowLeft size={15} /> {t('Back to My Patients')}
      </button>

      {episode && !isLoading && <PatientStepper episodeId={episodeId} tab={tab} />}

      {isLoading && <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>{t('Loading patient workspace…')}</div>}
      {error && !isLoading && <div className="glass-panel" style={{ padding: '24px', color: 'var(--rose-urgent)', textAlign: 'center' }}>{t(error)}</div>}

      {episode && !isLoading && (
        <>
          <CareWorkspaceLink episodeId={episodeId} role="doctor" />
          <div className="glass-panel" style={{ padding: '18px 22px', marginBottom: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div className="page-title" style={{ fontSize: '1.25rem' }}>{episode.patientName}</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {episode.age != null ? t('Age {age}', { age: episode.age }) : t('Age not recorded')} · EDD: {formatFriendlyDate(episode.edd)} · GA {episode.gestationalAgeWeeks}w{episode.gestationalAgeDays}d
              </div>
            </div>
            <button onClick={handleStartConsultation} className="btn-primary"><Stethoscope size={15} /> {t('Start Consultation')}</button>
          </div>

          {notice && <div className="glass-panel" style={{ padding: '10px 16px', marginBottom: '14px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{t(notice)}</div>}

          <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
            {tabs.map((tabItem) => (
              <button
                key={tabItem.key}
                onClick={() => setTab(tabItem.key)}
                style={{
                  padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', font: 'inherit',
                  fontSize: '0.85rem', fontWeight: tab === tabItem.key ? 700 : 500,
                  color: tab === tabItem.key ? 'var(--teal-text)' : 'var(--text-secondary)',
                  borderBottom: tab === tabItem.key ? '2px solid var(--teal-primary)' : '2px solid transparent',
                  marginBottom: '-1px',
                }}
              >
                {tabItem.label}
              </button>
            ))}
          </div>

          {tab === 'brief' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <BriefExtras episodeId={episodeId} />
              <TodaysBriefPanel episodeId={episodeId} />
            </div>
          )}

          {tab === 'audit' && <AuditTrailPanel episodeId={episodeId} patientName={episode.patientName} />}

          {tab === 'journey' && (
            journey.length === 0 ? (
              <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>{t('No journey events recorded yet.')}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {journey.map((e) => (
                  <div key={e.id} className="glass-panel" style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)' }}>{formatFriendlyDate(e.eventDate)}</div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{t(EVENT_TYPE_LABELS[e.eventType] ?? e.eventType)}</span>
                    </div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>{t(e.title)}</div>
                    {e.summary && <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '3px' }}>{t(e.summary)}</div>}
                  </div>
                ))}
              </div>
            )
          )}

          {tab === 'documents' && (
            documents.length === 0 ? (
              <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>{t('No documents yet.')}</div>
            ) : (
              <div className="glass-panel" style={{ padding: '4px 0' }}>
                {documents.map((d, i) => (
                  <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '14px 20px', borderBottom: i === documents.length - 1 ? 'none' : '1px solid var(--border-color)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{documentTitle(d, t)} <span className="document-kind">{t(typeLabel(d.documentType))}</span></div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{t('Uploaded by {name}', { name: d.uploadedByLoginOff ? t('{name} (care-team account, login off)', { name: d.uploadedByName }) : d.uploadedByName })}{d.filename !== documentTitle(d, t) && <> · {t('File: {name}', { name: d.filename })}</>}</div>
                    </div>
                    <StatusBadge label={t(d.statusLabel)} tone={DOCUMENT_STATUS_TONE[d.status]} />
                    <button onClick={() => handleViewOriginal(d.id)} title={t('View original')} style={{ background: 'none', border: 'none', color: 'var(--teal-primary)', cursor: 'pointer', display: 'flex' }}>
                      <Eye size={16} />
                    </button>
                    {d.status === 'NEEDS_REVIEW' && (
                      <>
                        <button onClick={() => handleVerify(d.id)} title={t('Verify')} style={{ background: 'none', border: 'none', color: 'var(--emerald-raw)', cursor: 'pointer', display: 'flex' }}>
                          <CheckCircle2 size={16} />
                        </button>
                        <button onClick={() => handleReject(d.id)} title={t('Reject')} style={{ background: 'none', border: 'none', color: 'var(--rose-urgent)', cursor: 'pointer', display: 'flex' }}>
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
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '14px' }}>{t('Start or continue a consultation for this patient.')}</p>
              <button onClick={handleStartConsultation} className="btn-primary"><Stethoscope size={15} /> {t('Start Consultation')}</button>
            </div>
          )}

          {tab === 'questions' && (
            questions.length === 0 ? (
              <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>{t('No questions for this patient.')}</div>
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
              <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>{t('No follow-ups for this patient.')}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {followUps.map((task) => (
                  <div key={task.id} className="glass-panel" style={{ padding: '14px 18px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{task.title}</div>
                        {task.autoGenerated && (
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--accent-teal, #0d9488)', background: 'rgba(13,148,136,0.12)', border: '1px solid rgba(13,148,136,0.3)', borderRadius: '999px', padding: '1px 8px', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>
                            {t('Auto')}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '3px' }}>{task.dueDate && <>{t('Due {date}', { date: formatFriendlyDate(task.dueDate) })}</>}{task.ownerName && <>{task.dueDate ? ' · ' : ''}{t('Owner: {name}', { name: task.ownerLoginOff ? t('{name} (care-team account, login off)', { name: task.ownerName }) : task.ownerName })}</>}</div>
                    </div>
                    <StatusBadge label={friendlyTaskStatus(task.status)} tone={TASK_STATUS_TONE[task.status]} />
                  </div>
                ))}
              </div>
            )
          )}

          {tab === 'referrals' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <button onClick={() => setIsCreateReferralOpen(true)} className="btn-primary"><Plus size={15} /> {t('Create Referral')}</button>
              </div>
              {referrals.length === 0 ? (
                <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>{t('No referrals for this patient yet.')}</div>
              ) : (
                referrals.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => navigate(`/doctor/referrals/${r.id}`)}
                    className="glass-panel"
                    style={{ padding: '14px 18px', textAlign: 'left', cursor: 'pointer', font: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}
                  >
                    <div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>{r.referenceCode}</div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{r.title}</div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{r.destination ?? t('Destination not specified')}</div>
                    </div>
                    <StatusBadge label={t(REFERRAL_STATUS_LABELS[r.status] ?? r.status.replace(/_/g, ' '))} tone="amber" />
                  </button>
                ))
              )}
            </div>
          )}

          {tab === 'handover' && (
            handover ? (
              <div className="glass-panel" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <StatusBadge label={handover.status === 'DRAFT' ? t('AI-Generated Draft') : t('Final · Shared Internally')} tone={handover.status === 'DRAFT' ? 'purple' : 'green'} />
                <HandoverField label={t('Context')} value={handover.context} />
                <HandoverField label={t('What Happened')} value={handover.whatHappened} />
                <HandoverField label={t('What Remains')} value={handover.whatRemains} />
                <HandoverField label={t('Who Owns It')} value={handover.whoOwnsIt} />
                <HandoverField label={t('What to Discuss')} value={handover.whatToDiscuss} />
                <button onClick={() => navigate('/doctor/handover')} className="btn-secondary" style={{ alignSelf: 'flex-start', fontSize: '0.8rem' }}>{t('Edit in Handover')}</button>
              </div>
            ) : (
              <div className="glass-panel" style={{ padding: '32px', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '14px' }}>{t('No handover exists yet for this patient.')}</p>
                <button onClick={() => navigate('/doctor/handover')} className="btn-primary">{t('Go to Handover')}</button>
              </div>
            )
          )}
        </>
      )}

      {isCreateReferralOpen && (
        <CreateReferralModal episodeId={episodeId} onClose={() => setIsCreateReferralOpen(false)} onCreated={() => { setIsCreateReferralOpen(false); refresh(); }} />
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
