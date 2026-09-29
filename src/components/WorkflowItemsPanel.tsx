import { useState } from 'react';
import type { PendingWorkflowItem, WorkflowItemType, WorkflowPriority, WorkflowStatus } from '../types/patient';
import { 
  ListTodo, 
  Share2, 
  FileCheck, 
  Calendar, 
  HelpCircle, 
  AlertTriangle, 
  PlusCircle, 
  Check, 
  UserCheck
} from 'lucide-react';

interface WorkflowItemsPanelProps {
  workflowItems: PendingWorkflowItem[];
  onUpdateStatus: (itemId: string, newStatus: WorkflowStatus) => void;
  onAddNewItem: () => void;
}

export const WorkflowItemsPanel: React.FC<WorkflowItemsPanelProps> = ({
  workflowItems,
  onUpdateStatus,
  onAddNewItem
}) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filteredItems = workflowItems.filter(item => {
    if (filterType !== 'all' && item.type !== filterType) return false;
    if (filterStatus !== 'all' && item.status !== filterStatus) return false;
    return true;
  });

  const getTypeIcon = (type: WorkflowItemType) => {
    switch (type) {
      case 'pending_referral': return <Share2 size={16} style={{ color: '#a855f7' }} />;
      case 'required_document': return <FileCheck size={16} style={{ color: '#38bdf8' }} />;
      case 'follow_up_needed': return <Calendar size={16} style={{ color: '#f59e0b' }} />;
      case 'unanswered_question': return <HelpCircle size={16} style={{ color: '#ec4899' }} />;
    }
  };

  const getTypeLabel = (type: WorkflowItemType) => {
    switch (type) {
      case 'pending_referral': return 'Pending Referral';
      case 'required_document': return 'Required Document';
      case 'follow_up_needed': return 'Follow-up Needed';
      case 'unanswered_question': return 'Unanswered Question';
    }
  };

  const getPriorityBadge = (priority: WorkflowPriority) => {
    switch (priority) {
      case 'urgent':
        return <span className="badge-urgent"><AlertTriangle size={12} /> URGENT</span>;
      case 'important':
        return <span className="badge-pending">IMPORTANT</span>;
      default:
        return (
          <span 
            style={{
              background: 'rgba(59, 130, 246, 0.12)',
              color: '#3b82f6',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              fontSize: '0.7rem',
              padding: '2px 8px',
              borderRadius: '999px',
              fontWeight: 600
            }}
          >
            ROUTINE
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
          <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', margin: 0, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ListTodo size={20} style={{ color: 'var(--amber-pending)' }} />
            Documented Workflow Items
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
            Extracted care gaps, pending referrals, missing reports, and unanswered patient inquiries flagged for consultation preparation.
          </p>
        </div>

        <button
          onClick={onAddNewItem}
          className="btn-primary"
          style={{ fontSize: '0.825rem' }}
        >
          <PlusCircle size={16} /> Add Workflow Item
        </button>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'All Items' },
            { id: 'unanswered_question', label: 'Unanswered Questions' },
            { id: 'pending_referral', label: 'Pending Referrals' },
            { id: 'required_document', label: 'Required Documents' },
            { id: 'follow_up_needed', label: 'Follow-ups' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilterType(f.id)}
              style={{
                background: filterType === f.id ? 'var(--bg-tertiary)' : 'transparent',
                color: filterType === f.id ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                border: filterType === f.id ? '1px solid var(--border-highlight)' : '1px solid transparent',
                borderRadius: 'var(--radius-sm)',
                padding: '5px 12px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div style={{ width: '1px', height: '20px', background: 'var(--border-color)' }} />

        {/* Status Filter */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            padding: '4px 10px',
            fontSize: '0.8rem'
          }}
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending Only</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed / Verified</option>
        </select>
      </div>

      {/* Items List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {filteredItems.length === 0 ? (
          <div className="glass-panel" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No workflow items found matching the selected filters.
          </div>
        ) : (
          filteredItems.map(item => {
            const isDone = item.status === 'completed';

            return (
              <div
                key={item.id}
                className="glass-panel animate-fade-in"
                style={{
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '16px',
                  opacity: isDone ? 0.65 : 1,
                  borderLeft: isDone ? '4px solid #10b981' : item.priority === 'urgent' ? '4px solid #f43f5e' : '4px solid #f59e0b'
                }}
              >
                {/* Left Content */}
                <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', flex: 1 }}>
                  <div 
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      background: 'var(--bg-tertiary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid var(--border-color)',
                      marginTop: '2px'
                    }}
                  >
                    {getTypeIcon(item.type)}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      {getPriorityBadge(item.priority)}

                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                        {getTypeLabel(item.type)}
                      </span>

                      <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>•</span>
                      
                      <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        Source: {item.sourceContext}
                      </span>
                    </div>

                    <h4 style={{ 
                      fontSize: '0.975rem', 
                      color: 'var(--text-primary)', 
                      margin: '0 0 6px 0', 
                      fontWeight: 700,
                      textDecoration: isDone ? 'line-through' : 'none'
                    }}>
                      {item.title}
                    </h4>

                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 8px 0', lineHeight: 1.45 }}>
                      {item.description}
                    </p>

                    {item.assignee && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <UserCheck size={13} /> Assigned Care Role: <strong>{item.assignee}</strong>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Action Toggle */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', minWidth: '130px' }}>
                  <span 
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: item.status === 'completed' ? 'var(--emerald-raw-bg)' : item.status === 'in_progress' ? 'rgba(6, 182, 212, 0.15)' : 'var(--amber-pending-bg)',
                      color: item.status === 'completed' ? 'var(--emerald-raw)' : item.status === 'in_progress' ? 'var(--accent-cyan)' : 'var(--amber-pending)',
                      border: '1px solid var(--border-color)'
                    }}
                  >
                    {item.status === 'completed' ? 'Verified / Closed' : item.status === 'in_progress' ? 'In Progress' : 'Pending Action'}
                  </span>

                  <div style={{ display: 'flex', gap: '4px' }}>
                    {item.status !== 'completed' && (
                      <button
                        onClick={() => onUpdateStatus(item.id, 'completed')}
                        className="btn-outline-emerald"
                        style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                      >
                        <Check size={13} /> Mark Verified
                      </button>
                    )}
                    {item.status === 'completed' && (
                      <button
                        onClick={() => onUpdateStatus(item.id, 'pending')}
                        style={{
                          background: 'transparent',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-muted)',
                          padding: '4px 8px',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.725rem',
                          cursor: 'pointer'
                        }}
                      >
                        Reopen
                      </button>
                    )}
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
