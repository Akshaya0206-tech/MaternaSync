import { useEffect, useState } from 'react';
import { Calendar, MapPin, Stethoscope } from 'lucide-react';
import { fetchMyAppointments } from '../../api/patientPortal';
import type { PatientAppointment } from '../../api/patientPortal';
import { StatusBadge } from '../../components/StatusBadge';
import type { BadgeTone } from '../../components/StatusBadge';
import { formatFriendlyDate, formatFriendlyTime, friendlyAppointmentStatus } from './format';

const STATUS_TONE: Record<string, BadgeTone> = {
  scheduled: 'blue',
  completed: 'green',
  cancelled: 'neutral',
};

export function AppointmentsPage() {
  const [appointments, setAppointments] = useState<PatientAppointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMyAppointments()
      .then(setAppointments)
      .catch(() => setError("We couldn't load your appointments. Please try again."))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <main style={{ padding: '24px', flex: 1, maxWidth: '760px', margin: '0 auto', width: '100%' }}>
      <h1 className="page-title" style={{ fontSize: '1.4rem', margin: '0 0 20px 0' }}>Appointments</h1>

      {isLoading && (
        <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading your appointments…</div>
      )}

      {error && !isLoading && (
        <div className="glass-panel" style={{ padding: '24px', color: 'var(--rose-urgent)', textAlign: 'center' }}>{error}</div>
      )}

      {!isLoading && !error && appointments.length === 0 && (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          No upcoming appointment has been recorded.
        </div>
      )}

      {!isLoading && !error && appointments.length > 0 && (
        <div className="glass-panel" style={{ padding: '4px 0' }}>
          {appointments.map((appt, index) => (
            <div
              key={appt.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '14px', padding: '18px 22px',
                borderBottom: index === appointments.length - 1 ? 'none' : '1px solid var(--border-color)',
              }}
            >
              <Calendar size={20} style={{ color: 'var(--teal-primary)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {formatFriendlyDate(appt.scheduledAt)} · {formatFriendlyTime(appt.scheduledAt)}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', marginTop: '4px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {appt.doctorName && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><Stethoscope size={13} /> {appt.doctorName}</span>
                  )}
                  {appt.location && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><MapPin size={13} /> {appt.location}</span>
                  )}
                </div>
              </div>
              <StatusBadge label={friendlyAppointmentStatus(appt.status)} tone={STATUS_TONE[appt.status] ?? 'neutral'} />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
