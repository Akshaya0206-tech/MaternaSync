export const inputStyle: React.CSSProperties = {
  background: 'var(--bg-tertiary)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-md)',
  padding: '10px 12px',
  color: 'var(--text-primary)',
  fontSize: '0.875rem',
  fontWeight: 400,
  outline: 'none',
  width: '100%'
};

interface FieldProps {
  label: string;
  children: React.ReactNode;
}

export const Field: React.FC<FieldProps> = ({ label, children }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
    {label}
    {children}
  </label>
);
