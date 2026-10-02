import { useState, useMemo } from 'react';
import type { ActivityLogEntry, ActivityLogAction } from '../types/patient';
import {
  History,
  Search,
  PlusCircle,
  CheckCircle2,
  Send,
  Copy,
  Filter,
  Stethoscope,
  Share2,
  ClipboardCheck,
  MessageCircle,
  CalendarCheck,
  PackageCheck
} from 'lucide-react';

interface ActivityLogPanelProps {
  activityLogs: ActivityLogEntry[];
  patientName: string;
  mrn: string;
}

export const ActivityLogPanel: React.FC<ActivityLogPanelProps> = ({
  activityLogs,
  patientName,
  mrn
}) => {
  const [filterAction, setFilterAction] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLogs = useMemo(() => {
    return activityLogs
      .filter(log => {
        if (filterAction !== 'all' && log.action !== filterAction) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = log.title.toLowerCase().includes(q);
          const matchDetails = log.details.toLowerCase().includes(q);
          const matchUser = log.user.toLowerCase().includes(q);
          const matchRole = log.role.toLowerCase().includes(q);
          if (!matchTitle && !matchDetails && !matchUser && !matchRole) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [activityLogs, filterAction, searchQuery]);

  const getActionBadge = (action: ActivityLogAction) => {
    switch (action) {
      case 'record_added':
        return (
          <span 
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              background: 'rgba(22, 124, 114, 0.15)',
              color: 'var(--accent-cyan)',
              border: '1px solid rgba(22, 124, 114, 0.3)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.725rem',
              fontWeight: 700
            }}
          >
            <PlusCircle size={12} /> Record Ingested
          </span>
        );
      case 'record_verified':
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
              fontSize: '0.725rem',
              fontWeight: 700
            }}
          >
            <CheckCircle2 size={12} /> Record Verified
          </span>
        );
      case 'record_replaced':
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
              fontSize: '0.725rem',
              fontWeight: 700
            }}
          >
            <Copy size={12} /> Record Replaced
          </span>
        );
      case 'workflow_created':
        return (
          <span 
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              background: 'rgba(109, 79, 166, 0.15)',
              color: 'var(--purple-ai)',
              border: '1px solid rgba(109, 79, 166, 0.3)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.725rem',
              fontWeight: 700
            }}
          >
            <History size={12} /> Workflow Created
          </span>
        );
      case 'workflow_updated':
        return (
          <span 
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              background: 'rgba(23, 50, 77, 0.15)',
              color: 'var(--navy-deep)',
              border: '1px solid rgba(23, 50, 77, 0.3)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.725rem',
              fontWeight: 700
            }}
          >
            <CheckCircle2 size={12} /> Workflow Updated
          </span>
        );
      case 'phase1_handoff':
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
              fontSize: '0.725rem',
              fontWeight: 700
            }}
          >
            <Send size={12} /> Phase 1 Handoff
          </span>
        );
      case 'consultation_approved':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              background: 'rgba(109, 79, 166, 0.15)',
              color: 'var(--purple-ai)',
              border: '1px solid rgba(109, 79, 166, 0.3)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.725rem',
              fontWeight: 700
            }}
          >
            <Stethoscope size={12} /> Consultation Approved
          </span>
        );
      case 'handover_updated':
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
              fontSize: '0.725rem',
              fontWeight: 700
            }}
          >
            <Share2 size={12} /> Handover Updated
          </span>
        );
      case 'workflow_reviewed':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              background: 'rgba(23, 50, 77, 0.15)',
              color: 'var(--navy-deep)',
              border: '1px solid rgba(23, 50, 77, 0.3)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.725rem',
              fontWeight: 700
            }}
          >
            <ClipboardCheck size={12} /> Workflow Reviewed
          </span>
        );
      case 'communication_draft_approved':
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
              fontSize: '0.725rem',
              fontWeight: 700
            }}
          >
            <MessageCircle size={12} /> Communication Draft Approved
          </span>
        );
      case 'next_visit_prepared':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              background: 'rgba(20, 184, 166, 0.15)',
              color: 'var(--accent-teal)',
              border: '1px solid rgba(20, 184, 166, 0.3)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.725rem',
              fontWeight: 700
            }}
          >
            <CalendarCheck size={12} /> Next Visit Prepared
          </span>
        );
      case 'transition_pack_created':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              background: 'rgba(23, 50, 77, 0.15)',
              color: 'var(--accent-blue)',
              border: '1px solid rgba(23, 50, 77, 0.3)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.725rem',
              fontWeight: 700
            }}
          >
            <PackageCheck size={12} /> Transition Pack Created
          </span>
        );
      default:
        return (
          <span
            style={{
              background: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.725rem',
              fontWeight: 600
            }}
          >
            {action}
          </span>
        );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Bar */}
      <div 
        className="glass-panel"
        style={{
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div>
          <h3 style={{ fontSize: '1.15rem', color: 'var(--text-primary)', margin: 0, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <History size={20} style={{ color: 'var(--accent-cyan)' }} />
            Phase 1 Activity & Audit Trail
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
            Immutable chronological logging of all data collection, clinician verifications, workflow updates, and handoffs for <strong>{patientName}</strong> ({mrn}).
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span 
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              padding: '4px 10px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.75rem',
              color: 'var(--accent-cyan)',
              fontWeight: 700
            }}
          >
            {activityLogs.length} Logged Events
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div 
        className="glass-panel"
        style={{
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
          <Search 
            size={15} 
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
            placeholder="Search by action, user, clinician, or details..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '7px 12px 7px 34px',
              color: 'var(--text-primary)',
              fontSize: '0.825rem',
              outline: 'none'
            }}
          />
        </div>

        {/* Filter Action Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Filter size={15} style={{ color: 'var(--text-muted)' }} />
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            style={{
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              padding: '6px 12px',
              fontSize: '0.8rem',
              cursor: 'pointer'
            }}
          >
            <option value="all">All Actions</option>
            <option value="record_added">Record Ingested</option>
            <option value="record_verified">Record Verified</option>
            <option value="record_replaced">Record Replaced</option>
            <option value="workflow_created">Workflow Created</option>
            <option value="workflow_updated">Workflow Updated</option>
            <option value="phase1_handoff">Phase 1 Handoff</option>
            <option value="consultation_approved">Consultation Approved</option>
            <option value="handover_updated">Handover Updated</option>
            <option value="workflow_reviewed">Workflow Reviewed</option>
            <option value="communication_draft_approved">Communication Draft Approved</option>
            <option value="next_visit_prepared">Next Visit Prepared</option>
            <option value="transition_pack_created">Transition Pack Created</option>
          </select>
        </div>
      </div>

      {/* Log Feed */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {filteredLogs.length === 0 ? (
          <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No activity log events match your filter criteria.
          </div>
        ) : (
          filteredLogs.map((log) => {
            const dateStr = new Date(log.timestamp).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            });
            const timeStr = new Date(log.timestamp).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit'
            });

            return (
              <div
                key={log.id}
                className="glass-panel animate-fade-in"
                style={{
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '16px'
                }}
              >
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flex: 1 }}>
                  <div style={{ marginTop: '2px' }}>
                    {getActionBadge(log.action)}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                      <strong style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                        {log.title}
                      </strong>
                      {log.recordId && (
                        <span 
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.7rem',
                            color: 'var(--text-muted)',
                            background: 'var(--bg-tertiary)',
                            padding: '1px 6px',
                            borderRadius: '3px'
                          }}
                        >
                          {log.recordId}
                        </span>
                      )}
                    </div>

                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 4px 0', lineHeight: 1.4 }}>
                      {log.details}
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                      <span>Actor: <strong style={{ color: 'var(--text-secondary)' }}>{log.user}</strong> ({log.role})</span>
                    </div>
                  </div>
                </div>

                {/* Timestamp */}
                <div style={{ textAlign: 'right', whiteSpace: 'nowrap', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <div>{dateStr}</div>
                  <div style={{ fontSize: '0.7rem' }}>{timeStr}</div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
