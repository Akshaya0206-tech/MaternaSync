import type { PatientEpisode } from '../types/patient';
import { User, AlertTriangle, ShieldAlert, CheckCircle } from 'lucide-react';

interface PatientHeaderProps {
  episode: PatientEpisode;
}

export const PatientHeader: React.FC<PatientHeaderProps> = ({ episode }) => {
  const getRiskBadge = () => {
    switch (episode.riskCategory) {
      case 'high_risk':
        return (
          <span className="badge-urgent">
            <AlertTriangle size={12} /> High Risk Episode
          </span>
        );
      case 'moderate':
        return (
          <span className="badge-pending">
            <ShieldAlert size={12} /> Moderate Risk
          </span>
        );
      default:
        return (
          <span className="badge-raw">
            <CheckCircle size={12} /> Routine Antenatal
          </span>
        );
    }
  };

  return (
    <div
      style={{
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)',
        padding: '14px 24px'
      }}
    >
      <div
        className="patient-header-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(260px, 1.3fr) repeat(3, minmax(140px, 1fr))',
          gap: '18px',
          alignItems: 'center'
        }}
      >
        {/* Patient identity */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', minWidth: 0 }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'var(--mint-soft)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--forest-deep)',
              flexShrink: 0
            }}
          >
            <User size={21} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                {episode.patientName}
              </strong>
              {getRiskBadge()}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {episode.age} yrs &middot; {episode.gravidaPara} &middot; {episode.bloodType}
              {episode.allergies.length > 0 && (
                <span style={{ color: 'var(--rose-urgent)' }}> &middot; Allergies: {episode.allergies.join(', ')}</span>
              )}
            </div>
          </div>
        </div>

        <HeaderFact label="Gestational Age" value={`${episode.gestationalAgeWeeks}w ${episode.gestationalAgeDays}d`} emphasize />
        <HeaderFact label="Estimated Due Date" value={episode.edd} />
        <div>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.03em' }}>
            Care Provider
          </span>
          <div style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {episode.primaryClinician}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {episode.facility}
          </div>
        </div>
      </div>
    </div>
  );
};

const HeaderFact: React.FC<{ label: string; value: string; emphasize?: boolean }> = ({ label, value, emphasize }) => (
  <div>
    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.03em' }}>
      {label}
    </span>
    <div style={{ fontSize: emphasize ? '1.15rem' : '0.95rem', fontWeight: 800, color: emphasize ? 'var(--teal-primary)' : 'var(--text-primary)', marginTop: '2px' }}>
      {value}
    </div>
  </div>
);
