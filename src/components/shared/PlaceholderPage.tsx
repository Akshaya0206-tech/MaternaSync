interface PlaceholderPageProps {
  title: string;
  description?: string;
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <main style={{ padding: '24px', flex: 1, maxWidth: '1440px', margin: '0 auto', width: '100%' }}>
      <div className="glass-panel" style={{ padding: '48px', textAlign: 'center' }}>
        <h1 className="page-title" style={{ fontSize: '1.3rem', margin: '0 0 10px 0' }}>{title}</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '480px', margin: '0 auto' }}>
          {description ?? 'This workspace is being built in an upcoming step. Navigation and access control are already fully wired up.'}
        </p>
      </div>
    </main>
  );
}
