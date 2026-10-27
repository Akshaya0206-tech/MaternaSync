import { useState } from 'react';
import { updateProfile } from '../../api/doctorPortal';
import type { DoctorProfile } from '../../api/doctorPortal';
import { Feedback, Field, useAction } from '../../components/continuity/shared';
import { useLanguage } from '../../i18n';
import { shownName } from './shownName';
import './doctor-profile.css';

/** How patients see this doctor's name: a title and the name to show them. Empty means her account name, as before. Her own screens and the
 *  audit log always show the account name. */
export function DoctorNameCard({ profile, onSaved }: { profile: DoctorProfile; onSaved: (next: DoctorProfile) => void }) {
  const { t } = useLanguage();
  const action = useAction();
  const [title, setTitle] = useState(profile.displayTitle ?? '');
  const [name, setName] = useState(profile.displayName ?? '');
  const preview = shownName(profile.fullName, title, name);

  return (
    <section className="glass-panel continuity-panel doctor-profile-card" aria-labelledby="doctor-name-title">
      <div className="continuity-panel-heading"><h2 id="doctor-name-title">{t('How my name appears to patients')}</h2></div>
      <p className="continuity-muted">{t('Patients see this in their appointments, in the summaries you release and on the card they can show at a hospital. Your own screens and the audit log always show your account name.')}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void action.run(async () => {
            onSaved(await updateProfile({ displayTitle: title.trim(), displayName: name.trim() }));
          }, t('Saved.'));
        }}
      >
        <div className="continuity-fields">
          <Field label={t('Title')}><input maxLength={20} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('e.g. Dr.')} /></Field>
          <Field label={t('Name shown to patients')}><input maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder={profile.fullName} /></Field>
        </div>
        <p className="continuity-muted" role="status" aria-live="polite">{t('Patients see: {name}', { name: preview })}</p>
        <Feedback error={action.error} message={action.message} />
        <div className="continuity-actions"><button className="btn-primary" disabled={action.busy}>{t('Save how my name appears')}</button></div>
      </form>
    </section>
  );
}
