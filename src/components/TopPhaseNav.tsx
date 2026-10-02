import type { PhaseStage } from '../types/patient';
import { Check } from 'lucide-react';

interface TopPhaseNavProps {
  currentPhase: PhaseStage;
  onSelectPhase: (phase: PhaseStage) => void;
}

const STEPS: { phase: PhaseStage; label: string }[] = [
  { phase: 'phase1', label: 'Context' },
  { phase: 'phase2', label: "Today's Brief" },
  { phase: 'consultation', label: 'Consultation' },
  { phase: 'workflow', label: 'Workflow' },
  { phase: 'continuity', label: 'Continuity & Follow-Up' }
];

export const TopPhaseNav: React.FC<TopPhaseNavProps> = ({ currentPhase, onSelectPhase }) => {
  const currentIndex = STEPS.findIndex(s => s.phase === currentPhase);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '4px',
        padding: '12px 24px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)'
      }}
    >
      {STEPS.map((step, idx) => {
        const isCompleted = idx < currentIndex;
        const isCurrent = idx === currentIndex;

        return (
          <div key={step.phase} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              onClick={() => onSelectPhase(step.phase)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)'
              }}
            >
              <span
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  flexShrink: 0,
                  background: isCompleted ? 'var(--emerald-raw-bg)' : isCurrent ? 'var(--btn-primary-bg)' : 'var(--bg-tertiary)',
                  color: isCompleted ? 'var(--emerald-raw)' : isCurrent ? '#ffffff' : 'var(--text-muted)',
                  border: isCompleted ? '1px solid var(--emerald-raw-border)' : 'none'
                }}
              >
                {isCompleted ? <Check size={12} /> : idx + 1}
              </span>
              <span
                style={{
                  fontSize: '0.8rem',
                  fontWeight: isCurrent ? 700 : 600,
                  color: isCurrent ? 'var(--text-primary)' : isCompleted ? 'var(--text-secondary)' : 'var(--text-muted)',
                  whiteSpace: 'nowrap'
                }}
              >
                {step.label}
              </span>
            </button>
            {idx < STEPS.length - 1 && (
              <span style={{ color: 'var(--border-highlight)', fontSize: '0.8rem', padding: '0 2px' }}>→</span>
            )}
          </div>
        );
      })}
    </div>
  );
};
