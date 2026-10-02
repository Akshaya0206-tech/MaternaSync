import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { fetchTasks, updateTask } from '../../api/careTeamPortal';
import type { Task } from '../../api/careTeamPortal';
import { StatusBadge } from '../../components/StatusBadge';
import { TASK_STATUS_TONE, friendlyTaskStatus, formatFriendlyDate } from './format';
import { AddTaskModal } from './AddTaskModal';

const STATUS_OPTIONS: Task['status'][] = ['OPEN', 'IN_PROGRESS', 'WAITING', 'COMPLETED', 'CANCELLED'];

export function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const load = () => {
    setIsLoading(true);
    fetchTasks()
      .then(setTasks)
      .catch(() => setError("We couldn't load tasks. Please try again."))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleStatusChange = async (taskId: string, status: string) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: status as Task['status'] } : t)));
    try {
      await updateTask(taskId, { status });
    } catch {
      load();
    }
  };

  return (
    <main style={{ padding: '24px', flex: 1, maxWidth: '900px', margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
        <h1 className="page-title" style={{ fontSize: '1.4rem', margin: 0 }}>Tasks &amp; Follow-ups</h1>
        <button onClick={() => setIsAddOpen(true)} className="btn-primary"><Plus size={15} /> Add Task</button>
      </div>

      {isLoading && <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>}
      {error && !isLoading && <div className="glass-panel" style={{ padding: '24px', color: 'var(--rose-urgent)', textAlign: 'center' }}>{error}</div>}
      {!isLoading && !error && tasks.length === 0 && (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>No tasks yet.</div>
      )}

      {!isLoading && !error && tasks.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {tasks.map((t) => (
            <div key={t.id} className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>{t.patientName}</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>{t.title}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Owner: {t.ownerName ?? 'Unassigned'}{t.dueDate && <> · Due {formatFriendlyDate(t.dueDate)}</>} · Priority: {t.priority}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <StatusBadge label={friendlyTaskStatus(t.status)} tone={TASK_STATUS_TONE[t.status]} />
                <select
                  value={t.status}
                  onChange={(e) => handleStatusChange(t.id, e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.78rem', cursor: 'pointer' }}
                >
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{friendlyTaskStatus(s)}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}

      {isAddOpen && <AddTaskModal onClose={() => setIsAddOpen(false)} onCreated={() => { setIsAddOpen(false); load(); }} />}
    </main>
  );
}
