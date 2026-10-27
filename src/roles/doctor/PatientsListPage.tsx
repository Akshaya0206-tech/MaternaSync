import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ListTodo, MessageCircle } from 'lucide-react';
import { fetchPatients } from '../../api/doctorPortal';
import type { DoctorPatientRow } from '../../api/doctorPortal';
import { tx, useLanguage } from '../../i18n';
import { formatFriendlyDate } from './format';
import { dueDatePassedWords } from './format';
import { rememberPatientOrder } from './workspaceNav';

type SortKey = 'name' | 'nextAppointment' | 'openItems' | 'dueDate';
type FilterKey = 'question' | 'overdue' | 'visit';

// Each chip is a plain yes/no about administrative facts: an open question, an overdue task, a visit in the next seven days.
const FILTERS: { key: FilterKey; label: string; matches: (p: DoctorPatientRow) => boolean }[] = [
  { key: 'question', label: tx('Has an unanswered question'), matches: (p) => p.questionCount > 0 },
  { key: 'overdue', label: tx('Has an overdue task'), matches: (p) => (p.overdueTasks ?? 0) > 0 },
  { key: 'visit', label: tx('Visit this week'), matches: (p) => Boolean(p.visitThisWeek) },
];

export function PatientsListPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [patients, setPatients] = useState<DoctorPatientRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [active, setActive] = useState<FilterKey[]>([]);

  useEffect(() => {
    fetchPatients()
      .then(setPatients)
      .catch(() => setError(tx("We couldn't load your patients. Please try again.")))
      .finally(() => setIsLoading(false));
  }, []);

  // The number on each chip counts all of her patients, whatever the other chips say.
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.key, patients.filter(f.matches).length])) as Record<FilterKey, number>, [patients]);

  const visible = useMemo(() => {
    const checks = FILTERS.filter((f) => active.includes(f.key));
    const filtered = patients.filter((p) => p.patientName.toLowerCase().includes(query.trim().toLowerCase()) && checks.every((f) => f.matches(p)));
    const sorted = [...filtered];
    if (sortKey === 'name') sorted.sort((a, b) => a.patientName.localeCompare(b.patientName));
    else if (sortKey === 'nextAppointment') sorted.sort((a, b) => (a.nextAppointment ?? '9999').localeCompare(b.nextAppointment ?? '9999'));
    else if (sortKey === 'openItems') sorted.sort((a, b) => b.openItems - a.openItems);
    else if (sortKey === 'dueDate') sorted.sort((a, b) => (a.edd || '9999').localeCompare(b.edd || '9999') || a.patientName.localeCompare(b.patientName));
    return sorted;
  }, [patients, query, sortKey, active]);

  // The order on screen (after the search, the chips and the sort) is the order Next and Previous follow inside a patient's workspace.
  useEffect(() => { if (!isLoading && !error) rememberPatientOrder(visible.map((p) => ({ id: p.episodeId, name: p.patientName }))); }, [visible, isLoading, error]);

  const filtering = query.trim() !== '' || active.length > 0;
  const toggle = (key: FilterKey) => setActive((now) => (now.includes(key) ? now.filter((k) => k !== key) : [...now, key]));
  const clear = () => { setQuery(''); setActive([]); };

  return (
    <main className="doctor-top" style={{ padding: '24px', flex: 1, maxWidth: '980px', margin: '0 auto', width: '100%' }}>
      <h1 className="page-title" style={{ fontSize: '1.4rem', margin: '0 0 18px 0' }}>{t('My Patients')}</h1>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('Search patients by name…')}
            aria-label={t('Search patients by name…')}
            style={{ width: '100%', padding: '9px 12px 9px 34px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
          />
        </div>
        <select
          value={sortKey}
          aria-label={t('Sort patients')}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          style={{ padding: '9px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.85rem', cursor: 'pointer' }}
        >
          <option value="name">{t('Sort: Name')}</option>
          <option value="nextAppointment">{t('Sort: Next Appointment')}</option>
          <option value="openItems">{t('Sort: Open Items')}</option>
          <option value="dueDate">{t('Sort: Due date')}</option>
        </select>
      </div>

      {patients.length > 0 && (
        <div className="patient-filters" role="group" aria-label={t('Show only patients who')}>
          {FILTERS.map((f) => (
            <button key={f.key} type="button" className="patient-filter" aria-pressed={active.includes(f.key)} onClick={() => toggle(f.key)}>
              {t(f.label)} <span className="patient-filter-count">{counts[f.key]}</span>
            </button>
          ))}
          {filtering && <button type="button" className="patient-filter-clear" onClick={clear}>{t('Clear filters')}</button>}
        </div>
      )}

      {isLoading && <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>{t('Loading your patients…')}</div>}
      {error && !isLoading && <div className="glass-panel" style={{ padding: '24px', color: 'var(--rose-urgent)', textAlign: 'center' }}>{t(error)}</div>}
      {!isLoading && !error && visible.length === 0 && (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          {patients.length === 0 ? t('No patients are assigned to you yet.') : t('No patients match your search or filters.')}
          {patients.length > 0 && filtering && (
            <div className="continuity-actions" style={{ justifyContent: 'center' }}>
              <button type="button" className="btn-secondary" onClick={clear}>{t('Clear filters')}</button>
            </div>
          )}
        </div>
      )}

      {!isLoading && !error && visible.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {visible.map((p) => {
            const passed = dueDatePassedWords(t, p.edd);
            const tasks = p.openItems === 1 ? t('1 open task') : t('{count} open tasks', { count: p.openItems });
            const questions = p.questionCount === 1 ? t('1 unanswered question') : t('{count} unanswered questions', { count: p.questionCount });
            return (
              <button
                key={p.episodeId}
                onClick={() => navigate(`/doctor/patients/${p.episodeId}`)}
                className="glass-panel"
                style={{ padding: '18px 22px', textAlign: 'left', cursor: 'pointer', font: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}
              >
                <div>
                  <div style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)' }}>{p.patientName}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {p.age != null ? t('Age {age}', { age: p.age }) : t('Age not recorded')}
                    {p.gestationalAgeWeeks != null && <> · {t('{weeks}w {days}d', { weeks: p.gestationalAgeWeeks, days: p.gestationalAgeDays ?? 0 })}</>}
                    {' · '}{t('EDD: {date}', { date: formatFriendlyDate(p.edd) })}
                    {passed && <> · {passed}</>}
                    {p.nextAppointment && <> · {t('Next visit {date}', { date: formatFriendlyDate(p.nextAppointment) })}</>}
                    {p.lastConsultation && <> · {t('Last consult {date}', { date: formatFriendlyDate(p.lastConsultation) })}</>}
                  </div>
                </div>
                <div className="patient-counts" style={{ display: 'flex', gap: '16px', fontSize: '0.8rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                  <span title={tasks} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <ListTodo size={14} aria-hidden="true" style={{ color: p.openItems > 0 ? 'var(--amber-pending)' : 'var(--text-muted)' }} /> {tasks}
                    {(p.overdueTasks ?? 0) > 0 && <> ({t('{count} overdue', { count: p.overdueTasks ?? 0 })})</>}
                  </span>
                  <span title={questions} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <MessageCircle size={14} aria-hidden="true" style={{ color: p.questionCount > 0 ? 'var(--amber-pending)' : 'var(--text-muted)' }} /> {questions}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </main>
  );
}
