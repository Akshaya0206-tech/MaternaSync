import { HeartPulse } from 'lucide-react';

export function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cream-warm)', gap: '10px', color: 'var(--text-secondary)' }}>
      <HeartPulse size={20} style={{ color: 'var(--teal-primary)' }} />
      <span style={{ fontSize: '0.9rem' }}>Loading MaternaSync…</span>
    </div>
  );
}
