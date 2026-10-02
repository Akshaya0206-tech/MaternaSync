import { useEffect, useState } from 'react';
import { fetchPatients } from '../../api/doctorPortal';
import type { DoctorPatientRow } from '../../api/doctorPortal';
import { TodaysBriefPanel } from './TodaysBriefPanel';

export function TodaysBriefPage() {
  const [patients, setPatients] = useState<DoctorPatientRow[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPatients()
      .then((list) => {
        setPatients(list);
        if (list.length > 0) setSelectedEpisodeId(list[0].episodeId);
      })
      .catch(() => setError("We couldn't load your patients."))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <main style={{ padding: '24px', flex: 1, maxWidth: '700px', margin: '0 auto', width: '100%' }}>
      <h1 className="page-title" style={{ fontSize: '1.4rem', margin: '0 0 18px 0' }}>Today's Brief</h1>

      {patients.length > 0 && (
        <div style={{ marginBottom: '18px' }}>
          <select
            value={selectedEpisodeId}
            onChange={(e) => setSelectedEpisodeId(e.target.value)}
            style={{ padding: '9px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer', minWidth: '220px' }}
          >
            {patients.map((p) => <option key={p.episodeId} value={p.episodeId}>{p.patientName}</option>)}
          </select>
        </div>
      )}

      {isLoading && <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>}
      {error && !isLoading && <div className="glass-panel" style={{ padding: '24px', color: 'var(--rose-urgent)', textAlign: 'center' }}>{error}</div>}
      {!isLoading && patients.length === 0 && (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>No patients are assigned to you yet.</div>
      )}

      {selectedEpisodeId && <TodaysBriefPanel episodeId={selectedEpisodeId} />}
    </main>
  );
}
