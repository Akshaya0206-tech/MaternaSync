import { HeartPulse } from 'lucide-react';

interface AuthLayoutProps {
  children: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        background: 'var(--cream-warm)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px'
      }}
    >
      <div style={{ width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'var(--forest-dark)',
              color: 'var(--mint-soft)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <HeartPulse size={20} />
          </div>
          <span style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>MaternaSync</span>
        </div>

        <div className="glass-panel" style={{ padding: '32px' }}>
          {children}
        </div>
      </div>
    </div>
  );
};
