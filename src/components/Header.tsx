import type { PatientEpisode } from '../types/patient';
import { 
  Activity, 
  ChevronDown, 
  Moon, 
  Sun, 
  Send, 
  CheckCircle2, 
  Shield, 
  PlusCircle
} from 'lucide-react';

interface HeaderProps {
  episodes: PatientEpisode[];
  activeEpisode: PatientEpisode;
  onSelectEpisode: (episodeId: string) => void;
  onOpenHandoffModal: () => void;
  onOpenAddRecordModal: () => void;
  onOpenSafetyModal: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  episodes,
  activeEpisode,
  onSelectEpisode,
  onOpenHandoffModal,
  onOpenAddRecordModal,
  onOpenSafetyModal,
  theme,
  onToggleTheme
}) => {
  const pendingCount = activeEpisode.workflowItems.filter(i => i.status !== 'completed').length;
  const isReady = activeEpisode.isReadyForTodayBrief;

  return (
    <header 
      style={{
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 40,
        boxShadow: 'var(--shadow-sm)'
      }}
    >
      {/* Left Branding */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div 
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 0 15px rgba(6, 182, 212, 0.4)'
            }}
          >
            <Activity size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', margin: 0, fontWeight: 700 }}>
                Materna<span style={{ color: 'var(--accent-cyan)' }}>Sync</span>
              </h1>
              <span 
                style={{
                  background: 'rgba(6, 182, 212, 0.12)',
                  color: 'var(--accent-cyan)',
                  border: '1px solid rgba(6, 182, 212, 0.3)',
                  fontSize: '0.68rem',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontWeight: 700,
                  letterSpacing: '0.04em'
                }}
              >
                PHASE 1
              </span>
            </div>
            <p style={{ fontSize: '0.725rem', color: 'var(--text-secondary)', margin: 0 }}>
              Clinician Context Aggregator & Patient Journey Engine
            </p>
          </div>
        </div>

        {/* Separator */}
        <div style={{ width: '1px', height: '28px', background: 'var(--border-color)' }} />

        {/* Patient Episode Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            PATIENT EPISODE:
          </span>
          <div style={{ position: 'relative' }}>
            <select
              value={activeEpisode.id}
              onChange={(e) => onSelectEpisode(e.target.value)}
              style={{
                appearance: 'none',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-highlight)',
                borderRadius: 'var(--radius-md)',
                padding: '6px 34px 6px 12px',
                fontSize: '0.85rem',
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
            <ChevronDown 
              size={14} 
              style={{ 
                position: 'absolute', 
                right: '10px', 
                top: '50%', 
                transform: 'translateY(-50%)', 
                pointerEvents: 'none',
                color: 'var(--text-secondary)' 
              }} 
            />
          </div>
        </div>
      </div>

      {/* Right Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Quick Add Synthetic Record */}
        <button
          onClick={onOpenAddRecordModal}
          className="btn-secondary"
          style={{ fontSize: '0.8rem', padding: '6px 12px' }}
          title="Import or collect new record into episode"
        >
          <PlusCircle size={15} style={{ color: 'var(--accent-cyan)' }} />
          <span>Add Record</span>
        </button>

        {/* Phase 1 Output Action: Ready for Today's Brief */}
        <button
          onClick={onOpenHandoffModal}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: isReady 
              ? 'linear-gradient(135deg, #10b981, #059669)' 
              : 'linear-gradient(135deg, #06b6d4, #3b82f6)',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: '0.825rem',
            padding: '7px 16px',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            cursor: 'pointer',
            boxShadow: isReady ? '0 0 15px rgba(16, 185, 129, 0.4)' : '0 4px 12px rgba(6, 182, 212, 0.3)',
            transition: 'all 0.2s ease'
          }}
        >
          {isReady ? (
            <>
              <CheckCircle2 size={16} />
              <span>Phase 1 Complete — Ready for Today's Brief</span>
            </>
          ) : (
            <>
              <Send size={15} />
              <span>Hand Off to Today's Brief</span>
              {pendingCount > 0 && (
                <span 
                  style={{
                    background: 'rgba(255, 255, 255, 0.25)',
                    padding: '1px 6px',
                    borderRadius: '10px',
                    fontSize: '0.7rem'
                  }}
                >
                  {pendingCount} Pending
                </span>
              )}
            </>
          )}
        </button>

        {/* Theme Toggle */}
        <button
          onClick={onToggleTheme}
          style={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-secondary)',
            width: '34px',
            height: '34px',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        {/* Safety Modal Button */}
        <button
          onClick={onOpenSafetyModal}
          style={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            color: 'var(--emerald-raw)',
            width: '34px',
            height: '34px',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
          title="Safety Rules & Governance"
        >
          <Shield size={17} />
        </button>
      </div>
    </header>
  );
};
