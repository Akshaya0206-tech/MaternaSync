import { PauseCircle } from 'lucide-react';

/** Shown at the top of the Handover page while handover is paused (see useHandoverPaused). */
export function HandoverPausedNotice() {
  return (
    <div
      role="status"
      className="glass-panel"
      style={{ padding: '14px 16px', marginBottom: '18px', display: 'flex', gap: '12px', alignItems: 'flex-start', background: 'var(--amber-pending-bg)', border: '1px solid var(--amber-pending)' }}
    >
      <PauseCircle size={20} aria-hidden="true" style={{ flexShrink: 0, marginTop: '2px', color: 'var(--amber-pending)' }} />
      <div style={{ fontSize: '0.84rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
        <strong>Handover is paused for now.</strong> It is being refined: the rules it follows and the way it
        works are under review. Until then it cannot be generated, regenerated, edited or shared. Handovers
        created earlier can still be read below.
      </div>
    </div>
  );
}
