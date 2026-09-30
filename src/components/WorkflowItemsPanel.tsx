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
  UserCheck, 
  Clock, 
  ShieldCheck, 
  Info
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
        return <span className="badge-urgent"><AlertTriangle size={12} /> URGENT (CLINICIAN ORDERED)</span>;
      case 'important':
        return <span className="badge-pending">IMPORTANT (DOCUMENTED)</span>;
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

  const getStatusBadge = (status: WorkflowStatus) => {
    switch (status) {
      case 'completed':
        return (
          <span 
            style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              padding: '3px 8px',
              borderRadius: '4px',
              background: 'var(--emerald-raw-bg)',
              color: 'var(--emerald-raw)',
              border: '1px solid var(--emerald-raw-border)'
            }}
          >
            Completed
          </span>
        );
      case 'verified':
        return (
          <span 
            style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              padding: '3px 8px',
              borderRadius: '4px',
              background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(16, 185, 129, 0.2))',
              color: '#34d399',
              border: '1px solid rgba(16, 185, 129, 0.4)'
            }}
          >
            Verified
          </span>
        );
      case 'in_progress':
        return (
          <span 
            style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              padding: '3px 8px',
              borderRadius: '4px',
              background: 'rgba(6, 182, 212, 0.15)',
              color: 'var(--accent-cyan)',
              border: '1px solid rgba(6, 182, 212, 0.3)'
            }}
          >
            In Progress
          </span>
        );
      case 'pending':
      default:
        return (
          <span 
            style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              padding: '3px 8px',
              borderRadius: '4px',
              background: 'var(--amber-pending-bg)',
              color: 'var(--amber-pending)',
              border: '1px solid rgba(245, 158, 11, 0.3)'
            }}
          >
            Pending
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

      {/* Safety Notice: No Automatic Clinical Urgency */}
      <div 
        style={{
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-sm)',
          padding: '8px 14px',
          fontSize: '0.75rem',
          color: 'var(--text-secondary)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}
      >
        <Info size={15} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} />
        <span>
          <strong>Clinical Boundary:</strong> MaternaSync does not calculate clinical risk or generate medical urgency automatically. Priority levels and due dates reflect explicitly documented orders entered by the clinical team.
        </span>
      </div>

      {/* Filter Tabs & Status Dropdown */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
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

        {/* Status Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Status:</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              padding: '5px 10px',
              fontSize: '0.8rem'
            }}
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="verified">Verified</option>
            <option value="completed">Completed</option>
          </select>
        </div>
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
            const createdDateStr = new Date(item.dateCreated).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            });
            const dueDateStr = item.dueDate ? new Date(item.dueDate).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }) : null;

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
                  opacity: isDone ? 0.7 : 1,
                  borderLeft: isDone ? '4px solid #10b981' : item.status === 'verified' ? '4px solid #06b6d4' : item.priority === 'urgent' ? '4px solid #f43f5e' : '4px solid #f59e0b',
                  flexWrap: 'wrap'
                }}
              >
                {/* Left Content */}
                <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', flex: 1, minWidth: '280px' }}>
                  <div 
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      background: 'var(--bg-tertiary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid var(--border-color)',
                      marginTop: '2px',
                      flexShrink: 0
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
                        Source Record: <strong>{item.sourceContext}</strong>
                      </span>
                    </div>

                    <h4 style={{ 
                      fontSize: '1rem', 
                      color: 'var(--text-primary)', 
                      margin: '0 0 6px 0', 
                      fontWeight: 700,
                      textDecoration: isDone ? 'line-through' : 'none'
                    }}>
                      {item.title}
                    </h4>

                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 10px 0', lineHeight: 1.5 }}>
                      {item.description}
                    </p>

                    {/* Metadata Detail Row */}
                    <div 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '14px', 
                        fontSize: '0.75rem', 
                        color: 'var(--text-muted)',
                        flexWrap: 'wrap',
                        background: 'var(--bg-primary)',
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-sm)',
                        width: 'fit-content'
                      }}
                    >
                      {item.assignee && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <UserCheck size={13} style={{ color: 'var(--accent-cyan)' }} />
                          <span>Assigned: <strong style={{ color: 'var(--text-secondary)' }}>{item.assignee}</strong> {item.assignedRole && `(${item.assignedRole})`}</span>
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={13} />
                        <span>Created: {createdDateStr}</span>
                      </div>

                      {dueDateStr && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: item.priority === 'urgent' ? 'var(--rose-urgent)' : 'var(--text-muted)' }}>
                          <Calendar size={13} />
                          <span>Due: <strong>{dueDateStr}</strong></span>
                        </div>
                      )}

                      {item.verificationStatus && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--emerald-raw)' }}>
                          <ShieldCheck size={13} />
                          <span>{item.verificationStatus}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Action Toggle */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', minWidth: '150px' }}>
                  {getStatusBadge(item.status)}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', alignItems: 'flex-end' }}>
                    <select
                      value={item.status}
                      onChange={(e) => onUpdateStatus(item.id, e.target.value as WorkflowStatus)}
                      style={{
                        background: 'var(--bg-tertiary)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '4px 8px',
                        fontSize: '0.75rem',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="pending">Status: Pending</option>
                      <option value="in_progress">Status: In Progress</option>
                      <option value="verified">Status: Verified</option>
                      <option value="completed">Status: Completed</option>
                    </select>

                    {item.status !== 'completed' && (
                      <button
                        onClick={() => onUpdateStatus(item.id, 'completed')}
                        className="btn-outline-emerald"
                        style={{ fontSize: '0.725rem', padding: '3px 8px', width: '100%', justifyContent: 'center' }}
                      >
                        <Check size={12} /> Mark Completed
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
