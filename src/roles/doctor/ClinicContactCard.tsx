import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getClinicEmergency, saveClinicContact } from '../../api/clinicEmergency';
import { Feedback, Field, useAction } from '../../components/continuity/shared';
import { useLanguage } from '../../i18n';
import './doctor-profile.css';

/** The clinic's name, phone and opening hours as patients see them on the card they can show at a hospital. It edits the very same record as
 *  Clinical Settings -> Clinic setup, so the two places always agree. */
export function ClinicContactCard() {
  const { t } = useLanguage();
  const action = useAction();
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [hours, setHours] = useState('');

  useEffect(() => {
    let active = true;
    getClinicEmergency()
      .then((clinic) => {
        if (!active) return;
        setName(clinic.name ?? '');
        setPhone(clinic.phone ?? '');
        setHours(clinic.hours ?? '');
        setLoaded(true);
      })
      .catch((error) => { if (active) setLoadError(error instanceof Error ? error.message : ''); });
    return () => { active = false; };
  }, []);

  return (
    <section className="glass-panel continuity-panel doctor-profile-card" aria-labelledby="clinic-contact-title">
      <div className="continuity-panel-heading"><h2 id="clinic-contact-title">{t('Clinic contact for patients')}</h2></div>
      <p className="continuity-muted">
        {t('Your patients see these on the card they can show at a hospital. They are the same details as in Clinical Settings, Clinic setup.')}{' '}
        <Link to="/doctor/clinical-settings#clinic-setup">{t('Open Clinic setup')}</Link>
      </p>
      <Feedback error={loadError || action.error} message={action.message} />
      {loaded && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void action.run(async () => {
              const saved = await saveClinicContact({ clinicName: name.trim() || null, clinicPhone: phone.trim() || null, clinicHours: hours.trim() || null });
              setName(saved.name ?? '');
              setPhone(saved.phone ?? '');
              setHours(saved.hours ?? '');
            }, t('Clinic details saved.'));
          }}
        >
          <div className="continuity-fields">
            <Field label={t('Clinic name')}><input maxLength={200} value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label={t('Clinic phone')}><input type="tel" maxLength={30} value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
            <Field label={t('Opening hours')}><input maxLength={200} value={hours} onChange={(e) => setHours(e.target.value)} placeholder={t('e.g. Mon–Sat 9:00–17:00')} /></Field>
          </div>
          <div className="continuity-actions"><button className="btn-primary" disabled={action.busy}>{t('Save clinic details')}</button></div>
        </form>
      )}
    </section>
  );
}
