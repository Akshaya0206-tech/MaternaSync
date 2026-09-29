import { useState, useMemo } from 'react';
import type { PatientRecord, RecordCategory } from '../types/patient';
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
  Activity
} from 'lucide-react';

interface TimelineViewProps {
  records: PatientRecord[];
  onSelectRecord: (record: PatientRecord) => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  records,
  onSelectRecord
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTrimester, setSelectedTrimester] = useState<number | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Filtering & Sorting logic
  const filteredRecords = useMemo(() => {
    return records
      .filter(record => {
        if (selectedCategory !== 'all' && record.category !== selectedCategory) return false;
        if (selectedTrimester !== 'all' && record.trimester !== selectedTrimester) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = record.title.toLowerCase().includes(q);
          const matchSummary = record.summaryText.toLowerCase().includes(q);
          const matchAuthor = record.author.toLowerCase().includes(q);
          const matchTag = record.tags.some(t => t.toLowerCase().includes(q));
          if (!matchTitle && !matchSummary && !matchAuthor && !matchTag) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
      });
  }, [records, selectedCategory, selectedTrimester, searchQuery, sortOrder]);

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Controls & Filter Bar */}
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
        {/* Search Input */}
        <div style={{ position: 'relative', flex: '1', minWidth: '240px' }}>
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
            placeholder="Search notes, labs, messages, tags, providers..."
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

        {/* Category Pills */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Filter:</span>
          {[
            { id: 'all', label: 'All Records' },
            { id: 'consultation_note', label: 'Consults' },
            { id: 'care_document', label: 'Docs & Labs' },
            { id: 'patient_message', label: 'Messages' },
            { id: 'referral', label: 'Referrals' },
            { id: 'follow_up', label: 'Follow-ups' }
          ].map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              style={{
                background: selectedCategory === cat.id ? 'var(--bg-tertiary)' : 'transparent',
                color: selectedCategory === cat.id ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                border: selectedCategory === cat.id ? '1px solid var(--border-highlight)' : '1px solid transparent',
                borderRadius: 'var(--radius-sm)',
                padding: '4px 10px',
                fontSize: '0.775rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Trimester Filter & Sort Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <select
            value={selectedTrimester}
            onChange={(e) => setSelectedTrimester(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            style={{
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              padding: '5px 10px',
              fontSize: '0.8rem',
              cursor: 'pointer'
            }}
          >
            <option value="all">Entire Gestation</option>
            <option value={1}>Trimester 1 (W1 - 12)</option>
            <option value={2}>Trimester 2 (W13 - 27)</option>
            <option value={3}>Trimester 3 (W28 - 40+)</option>
          </select>

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
            background: 'linear-gradient(180deg, var(--accent-cyan) 0%, rgba(6, 182, 212, 0.2) 100%)',
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
            <span style={{ fontSize: '0.8rem' }}>Try clearing your search query or selecting "Entire Gestation".</span>
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
                  animationDelay: `${index * 0.05}s`
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
                    boxShadow: '0 0 10px rgba(6, 182, 212, 0.4)',
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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

                    {/* Raw Source Badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="badge-raw">
                        <ShieldCheck size={12} /> APPROVED RAW RECORD
                      </span>
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
                          border: '1px solid var(--border-color)'
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
                        border: '1px solid var(--border-color)'
                      }}
                    >
                      {record.vitalSnapshot.bp && <span>BP: <strong>{record.vitalSnapshot.bp} mmHg</strong></span>}
                      {record.vitalSnapshot.weightLbs && <span>Weight: <strong>{record.vitalSnapshot.weightLbs} lbs</strong></span>}
                      {record.vitalSnapshot.fetalHeartRateBpm && <span>FHR: <strong>{record.vitalSnapshot.fetalHeartRateBpm} bpm</strong></span>}
                      {record.vitalSnapshot.fundalHeightCm && <span>Fundal Height: <strong>{record.vitalSnapshot.fundalHeightCm} cm</strong></span>}
                    </div>
                  )}

                  {/* Bottom Footer Details */}
                  <div 
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderTop: '1px solid var(--border-color)',
                      paddingTop: '10px',
                      marginTop: '4px',
                      fontSize: '0.775rem',
                      color: 'var(--text-muted)'
                    }}
                  >
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <span>Source: <strong>{record.facility}</strong></span>
                      <span>•</span>
                      <span>Author: <strong>{record.author}</strong></span>
                      <span>•</span>
                      <span style={{ fontFamily: 'var(--font-mono)' }}>ID: {record.sourceId}</span>
                    </div>

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
            );
          })
        )}
      </div>
    </div>
  );
};
