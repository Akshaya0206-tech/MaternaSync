import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--cream-warm)', gap: '12px', padding: '24px', textAlign: 'center' }}>
      <h1 className="page-title" style={{ fontSize: '1.6rem', margin: 0 }}>Page not found</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '420px' }}>
        The page you're looking for doesn't exist, or you don't have access to it.
      </p>
      <Link to="/" className="btn-primary" style={{ textDecoration: 'none', marginTop: '8px' }}>
        Back to MaternaSync
      </Link>
    </div>
  );
}
