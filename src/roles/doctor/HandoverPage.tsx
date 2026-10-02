import { useEffect, useState } from 'react';
import { Sparkles, Save, Share2 } from 'lucide-react';
import { fetchPatients, fetchHandover, generateHandover, updateHandover, shareHandover } from '../../api/doctorPortal';
import type { DoctorPatientRow, Handover } from '../../api/doctorPortal';
import { ApiError } from '../../api/client';
import { StatusBadge } from '../../components/StatusBadge';

const SECTIONS: { key: keyof Pick<Handover, 'context' | 'whatHappened' | 'whatRemains' | 'whoOwnsIt' | 'whatToDiscuss'>; label: string }[] = [
  { key: 'context', label: 'Context' },
  { key: 'whatHappened', label: 'What Happened' },
  { key: 'whatRemains', label: 'What Remains' },
  { key: 'whoOwnsIt', label: 'Who Owns It' },
  { key: 'whatToDiscuss', label: 'What to Discuss' },
];

export function HandoverPage() {
  const [patients, setPatients] = useState<DoctorPatientRow[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState('');
  const [handover, setHandover] = useState<Handover | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isActing, setIsActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

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
    fetchHandover(episodeId)
      .then((h) => {
        setHandover(h);
        if (h) setDrafts({ context: h.context, whatHappened: h.whatHappened, whatRemains: h.whatRemains, whoOwnsIt: h.whoOwnsIt, whatToDiscuss: h.whatToDiscuss });
      })
      .catch(() => setError("We couldn't load the handover for this patient."))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { if (selectedEpisodeId) loadHandover(selectedEpisodeId); }, [selectedEpisodeId]);

  const handleGenerate = async () => {
    setIsActing(true);
    setError(null);
    try {
      const h = await generateHandover(selectedEpisodeId);
      setHandover(h);
      setDrafts({ context: h.context, whatHappened: h.whatHappened, whatRemains: h.whatRemains, whoOwnsIt: h.whoOwnsIt, whatToDiscuss: h.whatToDiscuss });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not generate a handover draft.');
    } finally {
      setIsActing(false);
    }
  };

  const handleSave = async () => {
    if (!handover) return;
    setIsActing(true);
    setError(null);
    try {
      const h = await updateHandover(handover.id, drafts);
      setHandover(h);
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
          <button onClick={handleGenerate} disabled={isActing} className="btn-primary">
            <Sparkles size={15} /> Generate Handover Draft
          </button>
        </div>
      )}

      {!isLoading && handover && (
        <div className="glass-panel" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <StatusBadge label={handover.status === 'DRAFT' ? 'AI-Generated Draft' : 'Final · Shared Internally'} tone={handover.status === 'DRAFT' ? 'purple' : 'green'} />
            <button onClick={handleGenerate} disabled={isActing} className="btn-secondary" style={{ fontSize: '0.78rem' }}>
              <Sparkles size={13} /> Regenerate
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {SECTIONS.map((s) => (
              <div key={s.key}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: '5px' }}>{s.label}</div>
                <textarea
                  value={drafts[s.key] ?? ''}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [s.key]: e.target.value }))}
                  rows={2}
                  style={{ width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '10px 12px', color: 'var(--text-primary)', fontSize: '0.85rem', fontFamily: 'inherit', resize: 'vertical' }}
                />
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '18px' }}>
            <button onClick={handleSave} disabled={isActing} className="btn-secondary"><Save size={14} /> Save</button>
            <button onClick={handleShare} disabled={isActing || handover.status === 'FINAL'} className="btn-primary">
              <Share2 size={14} /> {handover.status === 'FINAL' ? 'Shared Internally' : 'Share Internally'}
            </button>
            {saved && <span style={{ fontSize: '0.8rem', color: 'var(--emerald-raw)', fontWeight: 600 }}>Saved</span>}
          </div>
        </div>
      )}
    </main>
  );
}
