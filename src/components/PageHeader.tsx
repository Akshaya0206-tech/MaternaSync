interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ eyebrow, title, subtitle, actions }) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '4px'
      }}
    >
      <div>
        {eyebrow && (
          <span
            style={{
              display: 'inline-block',
              fontSize: '0.7rem',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--teal-primary)',
              marginBottom: '4px'
            }}
          >
            {eyebrow}
          </span>
        )}
        <h2 className="page-title" style={{ fontSize: '1.65rem', margin: 0 }}>
          {title}
        </h2>
        {subtitle && (
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '4px 0 0 0', maxWidth: '640px', lineHeight: 1.5 }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>{actions}</div>}
    </div>
  );
};
