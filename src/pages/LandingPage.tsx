import { useNavigate, Link } from 'react-router-dom';
import { HeartPulse, Users, Stethoscope, ArrowRight, Building2 } from 'lucide-react';

const WORKSPACES = [
  {
    key: 'patient',
    title: 'Patient',
    description: 'Track your pregnancy journey, review your records, and ask your care team questions.',
    icon: <HeartPulse size={24} />,
  },
  {
    key: 'care-team',
    title: 'Care Team',
    description: 'Coordinate documents, questions, tasks, and referrals across your assigned patients.',
    icon: <Users size={24} />,
  },
  {
    key: 'doctor',
    title: 'Doctor',
    description: "Review Today's Brief, document consultations, and approve clinical follow-ups.",
    icon: <Stethoscope size={24} />,
  },
];

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream-warm)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '64px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
        <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'var(--forest-dark)', color: 'var(--mint-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <HeartPulse size={22} />
        </div>
        <span style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>MaternaSync</span>
      </div>
      <p style={{ fontSize: '1.05rem', textAlign: 'center', maxWidth: '560px', margin: '0 0 48px 0', color: 'var(--text-secondary)' }}>
        Connected maternal care, from every document to every follow-up.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', maxWidth: '920px', width: '100%' }}>
        {WORKSPACES.map((workspace) => (
          <button
            key={workspace.key}
            onClick={() => navigate('/signin')}
            className="glass-panel"
            style={{ padding: '28px', textAlign: 'left', cursor: 'pointer', font: 'inherit', display: 'flex', flexDirection: 'column', gap: '14px' }}
          >
            <span style={{ width: '46px', height: '46px', borderRadius: 'var(--radius-md)', background: 'var(--mint-soft)', color: 'var(--forest-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {workspace.icon}
            </span>
            <span className="page-title" style={{ fontSize: '1.1rem' }}>{workspace.title}</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{workspace.description}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 700, color: 'var(--teal-primary)', marginTop: 'auto' }}>
              Continue <ArrowRight size={15} />
            </span>
          </button>
        ))}
      </div>

      <Link
        to="/external-simulator"
        style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '40px', fontSize: '0.8rem', color: 'var(--text-muted)', textDecoration: 'none' }}
      >
        <Building2 size={14} /> External Hospital Simulator (Demo)
      </Link>
    </div>
  );
}
