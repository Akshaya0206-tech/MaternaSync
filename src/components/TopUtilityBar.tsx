import type { PatientEpisode } from '../types/patient';
import { ChevronDown, UploadCloud, Send, CheckCircle2 } from 'lucide-react';

interface EpisodeOption {
  id: string;
  patientName: string;
  gestationalAgeWeeks: number;
  gestationalAgeDays: number;
  riskCategory: 'routine' | 'moderate' | 'high_risk';
}

interface TopUtilityBarProps {
  episodes: EpisodeOption[];
  activeEpisode: PatientEpisode;
  onSelectEpisode: (episodeId: string) => void;
  onOpenUploadModal: () => void;
  onOpenHandoffModal: () => void;
}

export const TopUtilityBar: React.FC<TopUtilityBarProps> = ({
  episodes,
  activeEpisode,
  onSelectEpisode,
  onOpenUploadModal,
  onOpenHandoffModal
}) => {
  const pendingCount = activeEpisode.workflowItems.filter(i => i.status !== 'completed').length;
  const isReady = activeEpisode.isReadyForTodayBrief;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 24px',
        background: 'var(--bg-primary)',
        gap: '12px',
        flexWrap: 'wrap'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          Patient Episode
        </span>
        <div style={{ position: 'relative' }}>
          <select
            value={activeEpisode.id}
            onChange={(e) => onSelectEpisode(e.target.value)}
            style={{
              appearance: 'none',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '6px 32px 6px 12px',
              fontSize: '0.825rem',
              fontWeight: 600,
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            {episodes.map(ep => (
              <option key={ep.id} value={ep.id}>
                {ep.patientName} — Wk {ep.gestationalAgeWeeks}d{ep.gestationalAgeDays} ({ep.riskCategory === 'high_risk' ? 'High Risk' : ep.riskCategory === 'moderate' ? 'Moderate Risk' : 'Routine'})
              </option>
            ))}
          </select>
          <ChevronDown size={13} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-secondary)' }} />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button onClick={onOpenUploadModal} className="btn-secondary" style={{ fontSize: '0.8rem', padding: '6px 14px' }}>
          <UploadCloud size={15} /> Upload Medical Record
        </button>

        <button
          onClick={onOpenHandoffModal}
          className="btn-primary"
          style={{ fontSize: '0.8rem', padding: '7px 16px', background: isReady ? 'var(--teal-primary)' : 'var(--btn-primary-bg)' }}
        >
          {isReady ? <CheckCircle2 size={15} /> : <Send size={14} />}
          <span>{isReady ? 'Phase 1 Complete' : 'Hand Off to Today\'s Brief'}</span>
          {!isReady && pendingCount > 0 && (
            <span style={{ background: 'rgba(255,255,255,0.22)', padding: '1px 7px', borderRadius: '10px', fontSize: '0.68rem' }}>
              {pendingCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
};
