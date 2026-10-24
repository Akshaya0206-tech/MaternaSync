import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ListTodo, MessageCircle } from 'lucide-react';
import { fetchPatients } from '../../api/doctorPortal';
import type { DoctorPatientRow } from '../../api/doctorPortal';
import { tx, useLanguage } from '../../i18n';
import { formatFriendlyDate } from './format';

type SortKey = 'name' | 'nextAppointment' | 'openItems';

export function PatientsListPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [patients, setPatients] = useState<DoctorPatientRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');

  useEffect(() => {
    fetchPatients()
      .then(setPatients)
      .catch(() => setError(tx("We couldn't load your patients. Please try again.")))
      .finally(() => setIsLoading(false));
  }, []);

  const visible = useMemo(() => {
    const filtered = patients.filter((p) => p.patientName.toLowerCase().includes(query.trim().toLowerCase()));
    const sorted = [...filtered];
    if (sortKey === 'name') sorted.sort((a, b) => a.patientName.localeCompare(b.patientName));
    else if (sortKey === 'nextAppointment') sorted.sort((a, b) => (a.nextAppointment ?? '9999').localeCompare(b.nextAppointment ?? '9999'));
    else if (sortKey === 'openItems') sorted.sort((a, b) => b.openItems - a.openItems);
    return sorted;
  }, [patients, query, sortKey]);

  return (
    <main style={{ padding: '24px', flex: 1, maxWidth: '980px', margin: '0 auto', width: '100%' }}>
      <h1 className="page-title" style={{ fontSize: '1.4rem', margin: '0 0 18px 0' }}>{t('My Patients')}</h1>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '18px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('Search patients by name…')}
            style={{ width: '100%', padding: '9px 12px 9px 34px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
          />
        </div>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          style={{ padding: '9px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.85rem', cursor: 'pointer' }}
        >
          <option value="name">{t('Sort: Name')}</option>
          <option value="nextAppointment">{t('Sort: Next Appointment')}</option>
          <option value="openItems">{t('Sort: Open Items')}</option>
        </select>
      </div>

      {isLoading && <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>{t('Loading your patients…')}</div>}
      {error && !isLoading && <div className="glass-panel" style={{ padding: '24px', color: 'var(--rose-urgent)', textAlign: 'center' }}>{t(error)}</div>}
      {!isLoading && !error && visible.length === 0 && (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          {patients.length === 0 ? t('No patients are assigned to you yet.') : t('No patients match your search.')}
        </div>
      )}

      {!isLoading && !error && visible.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {visible.map((p) => (
            <button
              key={p.episodeId}
              onClick={() => navigate(`/doctor/patients/${p.episodeId}`)}
              className="glass-panel"
              style={{ padding: '18px 22px', textAlign: 'left', cursor: 'pointer', font: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}
            >
              <div>
                <div style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)' }}>{p.patientName}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {p.age != null ? t('Age {age}', { age: p.age }) : t('Age not recorded')} · {t('EDD: {date}', { date: formatFriendlyDate(p.edd) })}
                  {p.nextAppointment && <> · {t('Next visit {date}', { date: formatFriendlyDate(p.nextAppointment) })}</>}
                  {p.lastConsultation && <> · {t('Last consult {date}', { date: formatFriendlyDate(p.lastConsultation) })}</>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '16px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <ListTodo size={14} style={{ color: p.openItems > 0 ? 'var(--amber-pending)' : 'var(--text-muted)' }} /> {p.openItems}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <MessageCircle size={14} style={{ color: p.questionCount > 0 ? 'var(--amber-pending)' : 'var(--text-muted)' }} /> {p.questionCount}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </main>
  );
}
