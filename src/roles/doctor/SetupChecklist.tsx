import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Circle } from 'lucide-react';
import { fetchSetupStatus } from '../../api/doctorDashboard';
import type { SetupItem, SetupKey, SetupStatus } from '../../api/doctorDashboard';
import { tx, useLanguage } from '../../i18n';

// Where each line is set (the addresses are agreed with the Clinical Settings page: tab values and #anchors).
const WHERE: Record<SetupKey, string> = {
  clinic_contact: '/doctor/clinical-settings#clinic-details',
  booking_rules: '/doctor/clinical-settings#booking-rules',
  reply_time: '/doctor/clinical-settings#reply-time',
  followup_rules: '/doctor/clinical-settings?tab=followup-rules',
  hospitals: '/doctor/clinical-settings#clinic-details',
  education: '/doctor/clinical-settings?tab=education',
};

const LABEL: Record<SetupKey, string> = {
  clinic_contact: tx('Clinic name and phone'),
  booking_rules: tx('Booking rules'),
  reply_time: tx('Usual reply time'),
  followup_rules: tx('Follow-up rules approved'),
  hospitals: tx('Recommended hospitals'),
  education: tx('Patient education approved'),
};

/** The "Set up your clinic" card: what the clinic has filled in and what is still empty. It only checks the clinic's own setup, never a patient. */
export function SetupChecklist() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [open, setOpen] = useState(false);

  // If the server cannot say (an older server, or no signal), the card is simply left out.
  useEffect(() => {
    let active = true;
    fetchSetupStatus().then((s) => { if (active) setStatus(s); }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  if (!status) return null;
  const complete = status.done === status.total;

  const hint = (item: SetupItem): string => {
    switch (item.key) {
      case 'clinic_contact': return t('Shown to patients on the card they can show at a hospital.');
      case 'booking_rules': return t('The days, hours and visit length used to check visit requests.');
      case 'reply_time': return t('Patients see it on their My Questions page.');
      case 'followup_rules': return item.done ? t('{count} approved.', { count: item.count ?? 0 }) : t('None approved yet. Without one, no follow-up flag is raised.');
      case 'hospitals': return item.done ? t('{count} added. Patients see them on Emergency help.', { count: item.count ?? 0 }) : t('None added yet. Patients see them on Emergency help.');
      case 'education': return item.done
        ? t('{count} approved. The Care Companion can show these.', { count: item.count ?? 0 })
        : t('None approved yet. The patients’ Care Companion can only show notes a doctor has approved, so it tells patients it has no reviewed information.');
    }
  };

  if (complete && !open) {
    return (
      <section className="glass-panel setup-card setup-card-done" aria-label={t('Set up your clinic')}>
        <CheckCircle2 size={18} aria-hidden="true" className="setup-done-icon" />
        <p>{t('Your clinic is set up')}</p>
        <button type="button" className="btn-secondary" aria-expanded={false} onClick={() => setOpen(true)}>{t('Show checklist')}</button>
      </section>
    );
  }

  return (
    <section className="glass-panel setup-card" aria-labelledby="setup-heading">
      <div className="setup-head">
        <h2 id="setup-heading">{t('Set up your clinic')}</h2>
        <span className="setup-count" role="status">{t('{done} of {total} done', { done: status.done, total: status.total })}</span>
      </div>
      <p className="setup-lead">{t('What your patients see depends on what is set up here. This list only checks the clinic’s own setup; it never looks at a patient.')}</p>
      <ul className="setup-list">
        {status.items.map((item) => (
          <li key={item.key} className={item.done ? 'setup-item setup-item-done' : 'setup-item'}>
            {item.done ? <CheckCircle2 size={18} aria-hidden="true" /> : <Circle size={18} aria-hidden="true" />}
            <div className="setup-item-text">
              <strong>{t(LABEL[item.key])}</strong>
              <span className="setup-state">{item.done ? t('Done') : t('Not done yet')}</span>
              <p>{hint(item)}</p>
            </div>
            <button type="button" className={item.done ? 'btn-secondary' : 'btn-primary'} onClick={() => navigate(WHERE[item.key])}>
              {item.done ? t('Review') : t('Set up')}
              <span className="setup-sr"> — {t(LABEL[item.key])}</span>
            </button>
          </li>
        ))}
      </ul>
      {complete && <button type="button" className="btn-secondary" aria-expanded={true} onClick={() => setOpen(false)}>{t('Hide checklist')}</button>}
    </section>
  );
}
