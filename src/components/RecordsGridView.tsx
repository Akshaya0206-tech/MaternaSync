import { useState } from 'react';
import type { PatientRecord, RecordCategory, VerificationStatus } from '../types/patient';
import { 
  FileText, 
  Share2, 
  MessageSquare, 
  FileCheck, 
  Calendar, 
  Activity, 
  Eye, 
  ShieldCheck, 
  Search,
  CheckCircle2,
  Clock
} from 'lucide-react';

interface RecordsGridViewProps {
  records: PatientRecord[];
  onSelectRecord: (record: PatientRecord) => void;
}

export const RecordsGridView: React.FC<RecordsGridViewProps> = ({
  records,
  onSelectRecord
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const categories: { id: RecordCategory; label: string; icon: any }[] = [
    { id: 'consultation_note', label: 'Consultation Notes', icon: FileText },
    { id: 'care_document', label: 'Care Documents & Labs', icon: FileCheck },
    { id: 'referral', label: 'Referrals & Specialty Orders', icon: Share2 },
    { id: 'patient_message', label: 'Patient Communications', icon: MessageSquare },
    { id: 'follow_up', label: 'Follow-up Logs', icon: Calendar },
    { id: 'workflow_event', label: 'Workflow Events', icon: Activity }
  ];

  const filteredRecords = records.filter(rec => {
    if (activeCategory !== 'all' && rec.category !== activeCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        rec.title.toLowerCase().includes(q) ||
        rec.summaryText.toLowerCase().includes(q) ||
        rec.author.toLowerCase().includes(q) ||
        rec.facility.toLowerCase().includes(q) ||
        rec.sourceId.toLowerCase().includes(q) ||
        rec.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const getVerificationBadge = (status?: VerificationStatus) => {
    const s = status || 'raw';
    switch (s) {
      case 'ready_for_context':
        return (
          <span 
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              background: 'var(--emerald-raw-bg)',
              color: 'var(--teal-primary)',
              border: '1px solid rgba(22, 124, 114, 0.4)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.68rem',
              fontWeight: 800
            }}
          >
            <ShieldCheck size={11} /> READY FOR CONTEXT
          </span>
        );
      case 'verified':
        return (
          <span 
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              background: 'var(--emerald-raw-bg)',
              color: 'var(--emerald-raw)',
              border: '1px solid var(--emerald-raw-border)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.68rem',
              fontWeight: 800
            }}
          >
            <CheckCircle2 size={11} /> VERIFIED
          </span>
        );
      case 'raw':
      default:
        return (
          <span 
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              background: 'var(--amber-pending-bg)',
              color: 'var(--amber-pending)',
              border: '1px solid rgba(154, 91, 46, 0.3)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.68rem',
              fontWeight: 800
            }}
          >
            <Clock size={11} /> RAW
          </span>
        );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Search & Category Filter Header */}
      <div 
        className="glass-panel"
        style={{
          padding: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div style={{ position: 'relative', flex: '1', minWidth: '260px' }}>
          <Search 
            size={16} 
            style={{ 
              position: 'absolute', 
              left: '12px', 
              top: '50%', 
              transform: 'translateY(-50%)', 
              color: 'var(--text-muted)' 
            }} 
          />
          <input
            type="text"
            placeholder="Search collected records, facilities, authors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '8px 12px 8px 36px',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              outline: 'none'
            }}
          />
        </div>

        {/* Category Tabs */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveCategory('all')}
            style={{
              background: activeCategory === 'all' ? 'var(--bg-tertiary)' : 'transparent',
              color: activeCategory === 'all' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              border: activeCategory === 'all' ? '1px solid var(--border-highlight)' : '1px solid transparent',
              borderRadius: 'var(--radius-sm)',
              padding: '6px 12px',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            All Collected ({records.length})
          </button>
          {categories.map(cat => {
            const count = records.filter(r => r.category === cat.id).length;
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: activeCategory === cat.id ? 'var(--bg-tertiary)' : 'transparent',
                  color: activeCategory === cat.id ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                  border: activeCategory === cat.id ? '1px solid var(--border-highlight)' : '1px solid transparent',
                  borderRadius: 'var(--radius-sm)',
                  padding: '6px 12px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <Icon size={14} />
                <span>{cat.label}</span>
                <span style={{ opacity: 0.7, fontSize: '0.75rem' }}>({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid List */}
      <div 
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: '20px'
        }}
      >
        {filteredRecords.map((record) => {
          return (
            <div
              key={record.id}
              className="glass-panel animate-fade-in"
              style={{
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '14px',
                borderLeft: `4px solid var(--accent-cyan)`
              }}
            >
              <div>
                {/* Header Meta */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  {getVerificationBadge(record.verificationStatus)}

                  <span style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', fontWeight: 700 }}>
                    Wk {record.gestationalAgeWeeks}d{record.gestationalAgeDays}
                  </span>
                </div>

                {/* Title */}
                <h4 
                  onClick={() => onSelectRecord(record)}
                  style={{ 
                    fontSize: '1.02rem', 
                    color: 'var(--text-primary)', 
                    margin: '0 0 6px 0', 
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'color 0.2s'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-cyan)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                >
                  {record.title}
                </h4>

                {/* Date, Author, Facility */}
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                  {new Date(record.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} • {record.author} • {record.facility}
                </div>

                {/* Summary */}
                <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
                  {record.summaryText}
                </p>
              </div>

              {/* Footer */}
              <div 
                style={{
                  borderTop: '1px solid var(--border-color)',
                  paddingTop: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  ID: {record.sourceId}
                </span>

                <button
                  onClick={() => onSelectRecord(record)}
                  className="btn-outline-emerald"
                  style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                >
                  <Eye size={13} /> View Source & Provenance
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
