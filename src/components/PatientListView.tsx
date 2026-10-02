import { useMemo, useState } from 'react';
import type { PatientSummary } from '../api/patients';
import { PageHeader } from './PageHeader';
import { FolderHeart, Search, PlusCircle, FileText, ListTodo } from 'lucide-react';

interface PatientListViewProps {
  patients: PatientSummary[];
  isLoading: boolean;
  onOpenPatient: (id: string) => void;
  onCreatePatient: () => void;
}

export const PatientListView: React.FC<PatientListViewProps> = ({ patients, isLoading, onOpenPatient, onCreatePatient }) => {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter(p => p.patientName.toLowerCase().includes(q) || (p.mrn || '').toLowerCase().includes(q));
  }, [patients, query]);

  return (
    <main style={{ padding: '24px', flex: 1, maxWidth: '1100px', margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <PageHeader
          eyebrow="Context &amp; Data Collection"
          title="Patients"
          subtitle="Create a patient to begin organizing their care journey, or open an existing one to continue."
          actions={
            <button onClick={onCreatePatient} className="btn-primary" style={{ fontSize: '0.875rem' }}>
              <PlusCircle size={16} /> New Patient
            </button>
          }
        />

        <div style={{ position: 'relative', maxWidth: '360px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search patients..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '9px 12px 9px 34px', fontSize: '0.85rem', color: 'var(--text-primary)', outline: 'none' }}
          />
        </div>

        {isLoading ? (
          <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading patients…
          </div>
        ) : patients.length === 0 ? (
          <div className="glass-panel" style={{ padding: '48px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--mint-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--forest-deep)' }}>
              <FolderHeart size={26} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', margin: '0 0 4px 0' }}>No patients yet</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>Create a patient to begin organizing their care journey.</p>
            </div>
            <button onClick={onCreatePatient} className="btn-primary" style={{ fontSize: '0.85rem' }}>
              <PlusCircle size={15} /> New Patient
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No patients match "{query}".
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filtered.map(p => (
              <div key={p.id} className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{p.patientName}</strong>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {p.age != null ? `Age ${p.age} • ` : ''}EDD {p.edd}{p.mrn ? ` • ${p.mrn}` : ''}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '6px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><FileText size={13} /> {p.recordCount} record{p.recordCount === 1 ? '' : 's'}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><ListTodo size={13} /> {p.openWorkflowCount} open item{p.openWorkflowCount === 1 ? '' : 's'}</span>
                  </div>
                </div>
                <button onClick={() => onOpenPatient(p.id)} className="btn-secondary" style={{ fontSize: '0.825rem' }}>
                  Open Patient
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
};
