import { useState, useMemo } from 'react';
import type { PatientRecord, RecordCategory, VerificationStatus } from '../types/patient';
import { 
  FileText, 
  Share2, 
  MessageSquare, 
  FileCheck, 
  Calendar, 
  Search, 
  Eye, 
  ShieldCheck, 
  ArrowUpDown,
  Paperclip,
  Activity,
  CheckCircle2,
  Clock,
  RotateCcw
} from 'lucide-react';

interface TimelineViewProps {
  records: PatientRecord[];
  onSelectRecord: (record: PatientRecord) => void;
  onUpdateVerification?: (recordId: string, newStatus: VerificationStatus, verifier: string) => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  records,
  onSelectRecord,
  onUpdateVerification
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedVerification, setSelectedVerification] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Filtering & Sorting logic
  const filteredRecords = useMemo(() => {
    return records
      .filter(record => {
        // Category filter
        if (selectedCategory !== 'all' && record.category !== selectedCategory) return false;

        // Verification filter
        const recStatus = record.verificationStatus || 'raw';
        if (selectedVerification !== 'all' && recStatus !== selectedVerification) return false;

        // Date range filter
        if (startDate) {
          const startTimestamp = new Date(startDate).setHours(0, 0, 0, 0);
          const recTimestamp = new Date(record.timestamp).getTime();
          if (recTimestamp < startTimestamp) return false;
        }
        if (endDate) {
          const endTimestamp = new Date(endDate).setHours(23, 59, 59, 999);
          const recTimestamp = new Date(record.timestamp).getTime();
          if (recTimestamp > endTimestamp) return false;
        }

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = record.title.toLowerCase().includes(q);
          const matchSummary = record.summaryText.toLowerCase().includes(q);
          const matchAuthor = record.author.toLowerCase().includes(q);
          const matchFacility = record.facility.toLowerCase().includes(q);
          const matchSourceId = record.sourceId.toLowerCase().includes(q);
          const matchTag = record.tags.some(t => t.toLowerCase().includes(q));
          if (!matchTitle && !matchSummary && !matchAuthor && !matchFacility && !matchSourceId && !matchTag) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
      });
  }, [records, selectedCategory, selectedVerification, startDate, endDate, searchQuery, sortOrder]);

  const handleClearFilters = () => {
    setSelectedCategory('all');
    setSelectedVerification('all');
    setStartDate('');
    setEndDate('');
    setSearchQuery('');
  };

  const getCategoryIcon = (category: RecordCategory) => {
    switch (category) {
      case 'consultation_note': return <FileText size={16} />;
      case 'referral': return <Share2 size={16} />;
      case 'patient_message': return <MessageSquare size={16} />;
      case 'care_document': return <FileCheck size={16} />;
      case 'follow_up': return <Calendar size={16} />;
      case 'workflow_event': return <Activity size={16} />;
    }
  };

  const getCategoryLabel = (category: RecordCategory) => {
    switch (category) {
      case 'consultation_note': return 'Consultation Note';
      case 'referral': return 'Referral Order';
      case 'patient_message': return 'Patient Message';
      case 'care_document': return 'Care Document / Lab';
      case 'follow_up': return 'Follow-up Record';
      case 'workflow_event': return 'Workflow Event';
    }
  };

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
              fontSize: '0.7rem',
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
              fontSize: '0.7rem',
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
              fontSize: '0.7rem',
              fontWeight: 800
            }}
          >
            <Clock size={11} /> RAW
          </span>
        );
    }
  };

  const isFiltered = selectedCategory !== 'all' || selectedVerification !== 'all' || startDate !== '' || endDate !== '' || searchQuery.trim() !== '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Controls & Filter Bar */}
      <div 
        className="glass-panel"
        style={{
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}
      >
        {/* Row 1: Search + Date Range + Sort Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          {/* Search Input */}
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
              placeholder="Search notes, labs, messages, tags, providers, source IDs..."
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

          {/* Date Range Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Date Range:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              title="From Date"
              style={{
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                padding: '5px 8px',
                fontSize: '0.775rem'
              }}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              title="To Date"
              style={{
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                padding: '5px 8px',
                fontSize: '0.775rem'
              }}
            />

            {/* Sort Toggle */}
            <button
              onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
              style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
                padding: '5px 10px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.775rem',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer'
              }}
              title="Sort chronological order"
            >
              <ArrowUpDown size={14} />
              <span>{sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}</span>
            </button>

            {isFiltered && (
              <button
                onClick={handleClearFilters}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border-color)',
                  color: 'var(--accent-cyan)',
                  padding: '5px 10px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer'
                }}
                title="Reset all filters"
              >
                <RotateCcw size={12} /> Clear
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Category Filters + Verification Filter */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          {/* Category Filter Buttons */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Category:</span>
            {[
              { id: 'all', label: 'All' },
              { id: 'consultation_note', label: 'Consultations' },
              { id: 'care_document', label: 'Documents/Labs' },
              { id: 'referral', label: 'Referrals' },
              { id: 'patient_message', label: 'Patient Messages' },
              { id: 'follow_up', label: 'Follow-ups' },
              { id: 'workflow_event', label: 'Workflow Events' }
            ].map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                style={{
                  background: selectedCategory === cat.id ? 'var(--bg-tertiary)' : 'transparent',
                  color: selectedCategory === cat.id ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                  border: selectedCategory === cat.id ? '1px solid var(--border-highlight)' : '1px solid transparent',
                  borderRadius: 'var(--radius-sm)',
                  padding: '4px 9px',
                  fontSize: '0.775rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Verification Status Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Verification:</span>
            <select
              value={selectedVerification}
              onChange={(e) => setSelectedVerification(e.target.value)}
              style={{
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                padding: '4px 8px',
                fontSize: '0.775rem',
                cursor: 'pointer'
              }}
            >
              <option value="all">All Verification Statuses</option>
              <option value="raw">Raw Only</option>
              <option value="verified">Verified Only</option>
              <option value="ready_for_context">Ready for Context Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Timeline Stream */}
      <div style={{ position: 'relative', paddingLeft: '32px' }}>
        {/* Vertical Journey Line */}
        <div 
          style={{
            position: 'absolute',
            left: '14px',
            top: '10px',
            bottom: '10px',
            width: '2px',
            background: 'linear-gradient(180deg, var(--accent-cyan) 0%, rgba(22, 124, 114, 0.18) 100%)',
            borderRadius: '2px'
          }}
        />

        {filteredRecords.length === 0 ? (
          <div 
            className="glass-panel"
            style={{
              padding: '40px',
              textAlign: 'center',
              color: 'var(--text-muted)'
            }}
          >
            <Search size={32} style={{ margin: '0 auto 12px', display: 'block' }} />
            <p style={{ fontWeight: 600 }}>No records match your selected filter criteria.</p>
            <button 
              onClick={handleClearFilters}
              className="btn-secondary"
              style={{ marginTop: '10px', fontSize: '0.8rem' }}
            >
              Reset Filters
            </button>
          </div>
        ) : (
          filteredRecords.map((record, index) => {
            const dateStr = new Date(record.timestamp).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            });
            const timeStr = new Date(record.timestamp).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit'
            });

            return (
              <div 
                key={record.id}
                className="animate-fade-in"
                style={{
                  position: 'relative',
                  marginBottom: '24px',
                  animationDelay: `${index * 0.04}s`
                }}
              >
                {/* Timeline Node Dot */}
                <div 
                  style={{
                    position: 'absolute',
                    left: '-32px',
                    top: '16px',
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: 'var(--bg-secondary)',
                    border: `2px solid var(--accent-cyan)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent-cyan)',
                    boxShadow: 'var(--shadow-sm)',
                    zIndex: 2
                  }}
                >
                  {getCategoryIcon(record.category)}
                </div>

                {/* Timeline Card */}
                <div 
                  className="glass-panel"
                  style={{
                    padding: '16px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  {/* Top Meta Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span 
                        style={{
                          background: 'var(--bg-tertiary)',
                          color: 'var(--accent-cyan)',
                          fontSize: '0.75rem',
                          padding: '3px 10px',
                          borderRadius: 'var(--radius-sm)',
                          fontWeight: 700,
                          border: '1px solid var(--border-highlight)'
                        }}
                      >
                        Wk {record.gestationalAgeWeeks} + {record.gestationalAgeDays}d (T{record.trimester})
                      </span>

                      <span className={`category-${record.category}`} style={{ fontSize: '0.775rem', fontWeight: 600 }}>
                        {getCategoryLabel(record.category)}
                      </span>

                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>•</span>
                      
                      <span style={{ fontSize: '0.775rem', color: 'var(--text-secondary)' }}>
                        {dateStr} at {timeStr}
                      </span>
                    </div>

                    {/* Verification Status Badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {getVerificationBadge(record.verificationStatus)}
                    </div>
                  </div>

                  {/* Card Title */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                    <h3 
                      onClick={() => onSelectRecord(record)}
                      style={{ 
                        fontSize: '1.05rem', 
                        color: 'var(--text-primary)', 
                        margin: 0, 
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'color 0.2s ease'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-cyan)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                    >
                      {record.title}
                    </h3>

                    {record.attachmentName && (
                      <span 
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.725rem',
                          background: 'var(--bg-tertiary)',
                          color: 'var(--accent-cyan)',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          border: '1px solid var(--border-color)',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <Paperclip size={12} /> {record.attachmentName}
                      </span>
                    )}
                  </div>

                  {/* Non-interpretive Summary Body */}
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                    {record.summaryText}
                  </p>

                  {/* Vital Snapshot pill if present */}
                  {record.vitalSnapshot && (
                    <div 
                      style={{
                        display: 'flex',
                        gap: '12px',
                        background: 'var(--bg-tertiary)',
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.775rem',
                        color: 'var(--text-primary)',
                        width: 'fit-content',
                        border: '1px solid var(--border-color)',
                        flexWrap: 'wrap'
                      }}
                    >
                      {record.vitalSnapshot.bp && <span>BP: <strong>{record.vitalSnapshot.bp} mmHg</strong></span>}
                      {record.vitalSnapshot.weightLbs && <span>Weight: <strong>{record.vitalSnapshot.weightLbs} lbs</strong></span>}
                      {record.vitalSnapshot.fetalHeartRateBpm && <span>FHR: <strong>{record.vitalSnapshot.fetalHeartRateBpm} bpm</strong></span>}
                      {record.vitalSnapshot.fundalHeightCm && <span>Fundal Height: <strong>{record.vitalSnapshot.fundalHeightCm} cm</strong></span>}
                    </div>
                  )}

                  {/* Bottom Provenance Details & Actions */}
                  <div 
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderTop: '1px solid var(--border-color)',
                      paddingTop: '10px',
                      marginTop: '4px',
                      fontSize: '0.775rem',
                      color: 'var(--text-muted)',
                      flexWrap: 'wrap',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span>Facility: <strong>{record.facility}</strong></span>
                      <span>•</span>
                      <span>Author: <strong>{record.author}</strong></span>
                      <span>•</span>
                      <span style={{ fontFamily: 'var(--font-mono)' }}>ID: {record.sourceId}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {/* Quick verification action if still raw */}
                      {onUpdateVerification && (!record.verificationStatus || record.verificationStatus === 'raw') && (
                        <button
                          onClick={() => onUpdateVerification(record.id, 'verified', 'Dr. Eleanor Vance, MD')}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--emerald-raw)',
                            fontWeight: 600,
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <CheckCircle2 size={13} /> Verify Record
                        </button>
                      )}

                      <button
                        onClick={() => onSelectRecord(record)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--accent-cyan)',
                          fontWeight: 600,
                          fontSize: '0.775rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Eye size={14} /> View Raw Record Source
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
