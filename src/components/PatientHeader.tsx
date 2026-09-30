import type { PatientEpisode } from '../types/patient';
import { 
  User, 
  Clock, 
  ShieldAlert, 
  AlertTriangle, 
  FileText, 
  ListTodo, 
  CheckCircle,
  Tag,
  CheckCircle2,
  History,
  FileCheck2
} from 'lucide-react';

export type ActiveTabType = 'timeline' | 'grid' | 'completeness' | 'workflow' | 'activity';

interface PatientHeaderProps {
  episode: PatientEpisode;
  activeTab: ActiveTabType;
  onTabChange: (tab: ActiveTabType) => void;
}

export const PatientHeader: React.FC<PatientHeaderProps> = ({
  episode,
  activeTab,
  onTabChange
}) => {
  const pendingCount = episode.workflowItems.filter(i => i.status !== 'completed').length;
  const totalRecords = episode.records.length;

  const adminDocs = episode.administrativeDocs || [];
  const missingAdminCount = adminDocs.filter(d => d.status === 'missing').length;
  const pendingAdminCount = adminDocs.filter(d => d.status === 'pending_verification').length;

  const verifiedRecordsCount = episode.records.filter(r => r.verificationStatus === 'verified' || r.verificationStatus === 'ready_for_context').length;

  const getRiskBadge = () => {
    switch (episode.riskCategory) {
      case 'high_risk':
        return (
          <span className="badge-urgent" style={{ fontSize: '0.75rem', padding: '4px 10px' }}>
            <AlertTriangle size={13} /> HIGH-RISK EPISODE (CLINICAL DOCUMENTED)
          </span>
        );
      case 'moderate':
        return (
          <span className="badge-pending" style={{ fontSize: '0.75rem', padding: '4px 10px' }}>
            <ShieldAlert size={13} /> MODERATE RISK
          </span>
        );
      default:
        return (
          <span className="badge-raw" style={{ fontSize: '0.75rem', padding: '4px 10px' }}>
            <CheckCircle size={13} /> ROUTINE ANTENATAL
          </span>
        );
    }
  };

  return (
    <div 
      style={{
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)',
        padding: '16px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}
    >
      {/* Top Main Patient Info Row */}
      <div 
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        {/* Left: Patient Demographic Block */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div 
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(59, 130, 246, 0.2))',
              border: '1px solid var(--border-highlight)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-cyan)',
              fontSize: '1.2rem',
              fontWeight: 700
            }}
          >
            <User size={28} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.4rem', color: 'var(--text-primary)', margin: 0, fontWeight: 700 }}>
                {episode.patientName}
              </h2>
              <span 
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                  background: 'var(--bg-tertiary)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  border: '1px solid var(--border-color)'
                }}
              >
                {episode.mrn}
              </span>
              {getRiskBadge()}
            </div>

            <div 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '16px', 
                marginTop: '4px',
                fontSize: '0.825rem',
                color: 'var(--text-secondary)',
                flexWrap: 'wrap'
              }}
            >
              <span>Age: <strong>{episode.age} yrs</strong> ({episode.dob})</span>
              <span>•</span>
              <span>Gravida/Para: <strong>{episode.gravidaPara}</strong></span>
              <span>•</span>
              <span>Blood Type: <strong>{episode.bloodType}</strong></span>
              <span>•</span>
              <span style={{ color: episode.allergies.length > 0 ? '#f43f5e' : 'var(--text-secondary)' }}>
                Allergies: <strong>{episode.allergies.join(', ') || 'NKDA'}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Right: Gestational Metric Cards */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {/* Gestational Age Card */}
          <div 
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-highlight)',
              borderRadius: 'var(--radius-md)',
              padding: '8px 14px',
              display: 'flex',
              flexDirection: 'column',
              minWidth: '130px'
            }}
          >
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              GESTATIONAL AGE
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '2px' }}>
              <span style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>
                {episode.gestationalAgeWeeks}w {episode.gestationalAgeDays}d
              </span>
            </div>
          </div>

          {/* EDD Card */}
          <div 
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '8px 14px',
              display: 'flex',
              flexDirection: 'column',
              minWidth: '130px'
            }}
          >
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              ESTIMATED DUE DATE
            </span>
            <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
              {episode.edd}
            </span>
          </div>

          {/* Attending Provider Card */}
          <div 
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '8px 14px',
              display: 'flex',
              flexDirection: 'column',
              minWidth: '180px'
            }}
          >
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              CARE PROVIDER & FACILITY
            </span>
            <span style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
              {episode.primaryClinician}
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              {episode.facility}
            </span>
          </div>
        </div>
      </div>

      {/* Episode Context Summary Banner */}
      {episode.riskNotes && (
        <div 
          style={{
            background: 'rgba(31, 41, 55, 0.4)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            padding: '6px 12px',
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Tag size={14} style={{ color: 'var(--accent-cyan)' }} />
          <span><strong>Episode Context Summary:</strong> {episode.riskNotes}</span>
        </div>
      )}

      {/* Navigation Tabs Bar & Quick Stats */}
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid var(--border-color)',
          paddingTop: '12px',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => onTabChange('timeline')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 14px',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.825rem',
              fontWeight: 600,
              background: activeTab === 'timeline' ? 'var(--bg-tertiary)' : 'transparent',
              color: activeTab === 'timeline' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              border: activeTab === 'timeline' ? '1px solid var(--border-highlight)' : '1px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <Clock size={15} />
            <span>Chronological Journey</span>
            <span 
              style={{
                background: 'rgba(6, 182, 212, 0.15)',
                color: 'var(--accent-cyan)',
                fontSize: '0.7rem',
                padding: '1px 6px',
                borderRadius: '10px'
              }}
            >
              {totalRecords}
            </span>
          </button>

          <button
            onClick={() => onTabChange('grid')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 14px',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.825rem',
              fontWeight: 600,
              background: activeTab === 'grid' ? 'var(--bg-tertiary)' : 'transparent',
              color: activeTab === 'grid' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              border: activeTab === 'grid' ? '1px solid var(--border-highlight)' : '1px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <FileText size={15} />
            <span>Records Catalog</span>
          </button>

          <button
            onClick={() => onTabChange('completeness')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 14px',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.825rem',
              fontWeight: 600,
              background: activeTab === 'completeness' ? 'var(--bg-tertiary)' : 'transparent',
              color: activeTab === 'completeness' ? 'var(--accent-teal)' : 'var(--text-secondary)',
              border: activeTab === 'completeness' ? '1px solid rgba(20, 184, 166, 0.4)' : '1px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <FileCheck2 size={15} />
            <span>Record Completeness Check</span>
            {missingAdminCount > 0 ? (
              <span 
                style={{
                  background: 'var(--rose-urgent-bg)',
                  color: 'var(--rose-urgent)',
                  border: '1px solid rgba(244, 63, 94, 0.3)',
                  fontSize: '0.68rem',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  fontWeight: 700
                }}
              >
                {missingAdminCount} Missing
              </span>
            ) : pendingAdminCount > 0 ? (
              <span 
                style={{
                  background: 'var(--amber-pending-bg)',
                  color: 'var(--amber-pending)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  fontSize: '0.68rem',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  fontWeight: 700
                }}
              >
                {pendingAdminCount} Pending
              </span>
            ) : (
              <span 
                style={{
                  background: 'var(--emerald-raw-bg)',
                  color: 'var(--emerald-raw)',
                  border: '1px solid var(--emerald-raw-border)',
                  fontSize: '0.68rem',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  fontWeight: 700
                }}
              >
                Complete
              </span>
            )}
          </button>

          <button
            onClick={() => onTabChange('workflow')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 14px',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.825rem',
              fontWeight: 600,
              background: activeTab === 'workflow' ? 'var(--bg-tertiary)' : 'transparent',
              color: activeTab === 'workflow' ? 'var(--amber-pending)' : 'var(--text-secondary)',
              border: activeTab === 'workflow' ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <ListTodo size={15} />
            <span>Documented Workflow Items</span>
            {pendingCount > 0 && (
              <span 
                style={{
                  background: 'var(--amber-pending-bg)',
                  color: 'var(--amber-pending)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  fontSize: '0.68rem',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  fontWeight: 700
                }}
              >
                {pendingCount} Pending
              </span>
            )}
          </button>

          <button
            onClick={() => onTabChange('activity')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 14px',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.825rem',
              fontWeight: 600,
              background: activeTab === 'activity' ? 'var(--bg-tertiary)' : 'transparent',
              color: activeTab === 'activity' ? '#c084fc' : 'var(--text-secondary)',
              border: activeTab === 'activity' ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <History size={15} />
            <span>Activity / Audit Log</span>
            <span 
              style={{
                background: 'rgba(168, 85, 247, 0.15)',
                color: '#c084fc',
                fontSize: '0.68rem',
                padding: '1px 6px',
                borderRadius: '10px'
              }}
            >
              {(episode.activityLogs || []).length}
            </span>
          </button>
        </div>

        {/* Real-time Context Provenance Status Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="badge-raw" style={{ fontSize: '0.725rem' }}>
            <CheckCircle2 size={12} /> Verified Context: {verifiedRecordsCount} / {totalRecords} Records
          </span>
        </div>
      </div>
    </div>
  );
};
