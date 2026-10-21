import { useEffect, useState } from 'react';
import { Sparkles, Save, Share2, ChevronDown, ChevronUp } from 'lucide-react';
import { fetchPatients, fetchHandover, fetchHandoverHistory, generateHandover, updateHandover, shareHandover } from '../../api/careTeamPortal';
import type { CareTeamPatientRow, Handover, HandoverHistoryEntry } from '../../api/careTeamPortal';
import { ApiError } from '../../api/client';
import { StatusBadge } from '../../components/StatusBadge';
import { friendlyHandoverStatus, HANDOVER_STATUS_TONE, formatFriendlyDateTime } from './format';

const SECTIONS: { key: keyof Pick<Handover, 'context' | 'whatHappened' | 'whatRemains' | 'whoOwnsIt' | 'whatToDiscuss'>; label: string }[] = [
  { key: 'context', label: 'Context' },
  { key: 'whatHappened', label: 'What Happened' },
  { key: 'whatRemains', label: 'What Remains' },
  { key: 'whoOwnsIt', label: 'Who Owns It' },
  { key: 'whatToDiscuss', label: 'What to Discuss' },
];

export function HandoverPage() {
  const [patients, setPatients] = useState<CareTeamPatientRow[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState('');
  const [handover, setHandover] = useState<Handover | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [lastSavedDrafts, setLastSavedDrafts] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isActing, setIsActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [justGenerated, setJustGenerated] = useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<HandoverHistoryEntry[]>([]);
  const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null);

  useEffect(() => {
    fetchPatients()
      .then((list) => {
        setPatients(list);
        if (list.length > 0) setSelectedEpisodeId(list[0].episodeId);
        else setIsLoading(false);
      })
      .catch(() => { setError("We couldn't load your patients."); setIsLoading(false); });
  }, []);

  const loadHandover = (episodeId: string) => {
    setIsLoading(true);
    setError(null);
    setHistoryOpen(false);
    setHistory([]);
    fetchHandover(episodeId)
      .then((h) => {
        setHandover(h);
        if (h) {
          const content = { context: h.context, whatHappened: h.whatHappened, whatRemains: h.whatRemains, whoOwnsIt: h.whoOwnsIt, whatToDiscuss: h.whatToDiscuss };
          setDrafts(content);
          setLastSavedDrafts(content);
        }
      })
      .catch(() => setError("We couldn't load the handover for this patient."))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { if (selectedEpisodeId) loadHandover(selectedEpisodeId); }, [selectedEpisodeId]);

  const isDirty = handover != null && Object.keys(lastSavedDrafts).some((key) => drafts[key] !== lastSavedDrafts[key]);

  const doGenerate = async () => {
    setIsActing(true);
    setError(null);
    setShowRegenerateConfirm(false);
    try {
      const h = await generateHandover(selectedEpisodeId);
      setHandover(h);
      const content = { context: h.context, whatHappened: h.whatHappened, whatRemains: h.whatRemains, whoOwnsIt: h.whoOwnsIt, whatToDiscuss: h.whatToDiscuss };
      setDrafts(content);
      setLastSavedDrafts(content);
      setHistoryOpen(false);
      setHistory([]);
      setJustGenerated(true);
      window.setTimeout(() => setJustGenerated(false), 4000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not generate a handover draft.');
    } finally {
      setIsActing(false);
    }
  };

  const handleRegenerateClick = () => {
    if (isDirty) {
      setShowRegenerateConfirm(true);
      return;
    }
    void doGenerate();
  };

  const handleSave = async () => {
    if (!handover) return;
    setIsActing(true);
    setError(null);
    try {
      const h = await updateHandover(handover.id, drafts);
      setHandover(h);
      setLastSavedDrafts(drafts);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your edits.');
    } finally {
      setIsActing(false);
    }
  };

  const handleShare = async () => {
    if (!handover) return;
    setIsActing(true);
    setError(null);
    try {
      const h = await shareHandover(handover.id);
      setHandover(h);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not share this handover.');
    } finally {
      setIsActing(false);
    }
  };

  const toggleHistory = async () => {
    if (historyOpen) { setHistoryOpen(false); return; }
    setHistoryOpen(true);
    if (history.length === 0 && selectedEpisodeId) {
      try {
        const rows = await fetchHandoverHistory(selectedEpisodeId);
        setHistory(rows);
      } catch {
        setHistory([]);
      }
    }
  };

  const selectedPatient = patients.find((p) => p.episodeId === selectedEpisodeId);

  return (
    <main style={{ padding: '24px', flex: 1, maxWidth: '700px', margin: '0 auto', width: '100%' }}>
      <h1 className="page-title" style={{ fontSize: '1.4rem', margin: '0 0 18px 0' }}>Handover</h1>

      {patients.length > 0 && (
        <div style={{ marginBottom: '18px' }}>
          <select
            value={selectedEpisodeId}
            onChange={(e) => setSelectedEpisodeId(e.target.value)}
            style={{ padding: '9px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer', minWidth: '220px' }}
          >
            {patients.map((p) => <option key={p.episodeId} value={p.episodeId}>{p.patientName}</option>)}
          </select>
        </div>
      )}

      {patients.length === 0 && !isLoading && (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>No patients are assigned to you yet.</div>
      )}

      {isLoading && <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>}
      {error && !isLoading && <div className="glass-panel" style={{ padding: '18px', color: 'var(--rose-urgent)', textAlign: 'center', marginBottom: '14px' }}>{error}</div>}

      {!isLoading && selectedPatient && !handover && (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '16px' }}>
            No handover exists yet for {selectedPatient.patientName}.
          </p>
          <button onClick={doGenerate} disabled={isActing} className="btn-primary">
            <Sparkles size={15} /> Generate Handover Draft
          </button>
        </div>
      )}

      {!isLoading && handover && (
        <div className="glass-panel" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <StatusBadge label={friendlyHandoverStatus(handover.status)} tone={HANDOVER_STATUS_TONE[handover.status] ?? 'neutral'} />
            <button onClick={handleRegenerateClick} disabled={isActing} className="btn-secondary" style={{ fontSize: '0.78rem' }}>
              <Sparkles size={13} /> Regenerate
            </button>
          </div>

          <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: '0 0 6px 0' }}>
            Regenerate creates a fresh handover draft from the latest available patient journey, approved
            documentation, open tasks, referrals and unanswered questions. It does not approve or share the
            draft. Review the result before using it.
          </p>

          {justGenerated && (
            <div style={{ fontSize: '0.78rem', color: 'var(--emerald-raw)', fontWeight: 600, marginBottom: '8px' }}>
              New draft generated. Review the content before approval.
              {handover.sourceDataChanged === false && ' No new information since the previous version.'}
            </div>
          )}

          {showRegenerateConfirm && (
            <div className="glass-panel" style={{ padding: '14px 16px', marginBottom: '14px', background: 'var(--amber-pending-bg)' }}>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-primary)', margin: '0 0 10px 0' }}>
                Your unsaved edits to this draft won't be included in the new version — they'll remain on
                version {handover.version} if you want to view them later, but it will no longer be the
                current version. Continue?
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setShowRegenerateConfirm(false)} className="btn-secondary" style={{ fontSize: '0.78rem' }}>Cancel</button>
                <button onClick={doGenerate} disabled={isActing} className="btn-primary" style={{ fontSize: '0.78rem' }}>Regenerate Anyway</button>
              </div>
            </div>
          )}

          <button onClick={toggleHistory} className="btn-secondary" style={{ fontSize: '0.76rem', marginBottom: '14px' }}>
            Version {handover.version}{history.length ? ` of ${history.length}` : ''} · {historyOpen ? 'Hide history' : 'View history'}
            {historyOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          {historyOpen && (
            <div style={{ marginBottom: '16px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
              {history.length === 0 && <div style={{ padding: '14px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Loading history…</div>}
              {history.map((v, i) => {
                const isOpen = expandedVersionId === v.id;
                return (
                  <div key={v.id} style={{ borderBottom: i === history.length - 1 ? 'none' : '1px solid var(--border-color)' }}>
                    <button
                      onClick={() => setExpandedVersionId(isOpen ? null : v.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', textAlign: 'left' }}
                    >
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>v{v.version}</span>
                      <StatusBadge label={friendlyHandoverStatus(v.status)} tone={HANDOVER_STATUS_TONE[v.status] ?? 'neutral'} />
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', flex: 1 }}>
                        {formatFriendlyDateTime(v.createdAt)} · {v.createdByName}
                        {v.sourceDataChanged === false && ' · No change from previous version'}
                      </span>
                      {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    {isOpen && (
                      <div style={{ padding: '0 14px 14px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {SECTIONS.map((s) => (
                          <div key={s.key}>
                            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{s.label}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{v[s.key]}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {SECTIONS.map((s) => (
              <div key={s.key}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: '5px' }}>{s.label}</div>
                <textarea
                  value={drafts[s.key] ?? ''}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [s.key]: e.target.value }))}
                  disabled={handover.status !== 'DRAFT'}
                  rows={2}
                  style={{ width: '100%', background: handover.status !== 'DRAFT' ? 'var(--bg-secondary)' : 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '10px 12px', color: 'var(--text-primary)', fontSize: '0.85rem', fontFamily: 'inherit', resize: 'vertical' }}
                />
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '18px' }}>
            <button onClick={handleSave} disabled={isActing || handover.status !== 'DRAFT'} className="btn-secondary"><Save size={14} /> Save</button>
            <button onClick={handleShare} disabled={isActing || handover.status !== 'DRAFT'} className="btn-primary">
              <Share2 size={14} /> {handover.status === 'FINAL' ? 'Shared Internally' : 'Share Internally'}
            </button>
            {saved && <span style={{ fontSize: '0.8rem', color: 'var(--emerald-raw)', fontWeight: 600 }}>Saved</span>}
          </div>
        </div>
      )}
    </main>
  );
}
