import { useEffect, useState } from 'react';
import { addClinicHospital, changeClinicHospital, getClinicEmergency, removeClinicHospital, saveClinicContact } from '../../api/clinicEmergency';
import type { ClinicEmergency, ClinicHospitalRow, HospitalInput } from '../../api/clinicEmergency';
import { Feedback, Field, useAction } from '../../components/continuity/shared';
import { useLanguage } from '../../i18n';

const BLANK: HospitalInput = { name: '', address: null, phone: null, note: null };

/** What the clinic tells its patients on their Emergency help page: its own name and phone, and the hospitals it recommends. A doctor writes it;
 *  each change is recorded in the audit log. Contact details only: nothing about any patient. */
export function ClinicEmergencySettings() {
  const { t } = useLanguage();
  const action = useAction();
  const [data, setData] = useState<ClinicEmergency | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [hours, setHours] = useState('');
  const [editing, setEditing] = useState<string | null>(null); // a hospital's id, or "new"
  const [loadError, setLoadError] = useState('');

  const show = (next: ClinicEmergency) => {
    setData(next);
    setName(next.name ?? '');
    setPhone(next.phone ?? '');
    setHours(next.hours ?? '');
  };

  useEffect(() => {
    let active = true;
    getClinicEmergency()
      .then((next) => { if (active) show(next); })
      .catch((error) => { if (active) setLoadError(error instanceof Error ? error.message : ''); });
    return () => { active = false; };
  }, []);

  return (
    <details className="glass-panel continuity-panel clinic-emergency">
      <summary><h2 style={{ display: 'inline' }}>{t('Clinic details for your patients’ Emergency help')}</h2></summary>
      <p className="continuity-muted">
        {t('Your patients see the hospitals below on their Emergency help page, and the clinic name and phone on the card they can show at a hospital. Put contact details only: nothing about any patient. Every change is recorded in the audit log.')}
      </p>
      <Feedback error={loadError || action.error} message={action.message} />
      {data && (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void action.run(async () => {
                show(await saveClinicContact({ clinicName: name.trim() || null, clinicPhone: phone.trim() || null, clinicHours: hours.trim() || null }));
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

          <h3>{t('Hospitals your clinic recommends')}</h3>
          {data.hospitals.length === 0 && editing !== 'new' && (
            <p className="continuity-empty">{t('No hospitals added yet. Patients see this list above the map list on their Emergency help page.')}</p>
          )}
          {data.hospitals.map((hospital) =>
            editing === hospital.id ? (
              <HospitalForm
                key={hospital.id}
                initial={hospital}
                busy={action.busy}
                submit={t('Save changes')}
                onCancel={() => setEditing(null)}
                onSave={(input) =>
                  action.run(async () => {
                    show(await changeClinicHospital(hospital.id, input));
                    setEditing(null);
                  }, t('Hospital changed.'))
                }
              />
            ) : (
              <article key={hospital.id} className="continuity-item">
                <h3>{hospital.name}</h3>
                {hospital.note && <p>{hospital.note}</p>}
                <p className="continuity-muted">{[hospital.address, hospital.phone].filter(Boolean).join(' · ')}</p>
                <div className="continuity-actions">
                  <button type="button" className="btn-secondary" aria-label={`${t('Edit')}: ${hospital.name}`} onClick={() => setEditing(hospital.id)}>{t('Edit')}</button>
                  <button
                    type="button"
                    className="btn-secondary"
                    aria-label={`${t('Remove')}: ${hospital.name}`}
                    disabled={action.busy}
                    onClick={() => {
                      if (!window.confirm(t('Remove this hospital from your patients’ Emergency help page?'))) return;
                      void action.run(async () => { show(await removeClinicHospital(hospital.id)); setEditing(null); }, t('Hospital removed.'));
                    }}
                  >
                    {t('Remove')}
                  </button>
                </div>
              </article>
            ),
          )}
          {editing === 'new' ? (
            <HospitalForm
              initial={BLANK}
              busy={action.busy}
              submit={t('Add hospital')}
              onCancel={() => setEditing(null)}
              onSave={(input) =>
                action.run(async () => {
                  show(await addClinicHospital(input));
                  setEditing(null);
                }, t('Hospital added.'))
              }
            />
          ) : (
            <div className="continuity-actions">
              <button type="button" className="btn-secondary" onClick={() => setEditing('new')}>{t('Add a hospital')}</button>
            </div>
          )}
        </>
      )}
    </details>
  );
}

function HospitalForm({ initial, busy, submit, onSave, onCancel }: {
  initial: ClinicHospitalRow | HospitalInput;
  busy: boolean;
  submit: string;
  onSave: (input: HospitalInput) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState({ name: initial.name, address: initial.address ?? '', phone: initial.phone ?? '', note: initial.note ?? '' });
  const set = (key: keyof typeof draft, value: string) => setDraft((old) => ({ ...old, [key]: value }));
  return (
    <form
      className="continuity-item"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave({ name: draft.name.trim(), address: draft.address.trim() || null, phone: draft.phone.trim() || null, note: draft.note.trim() || null });
      }}
    >
      <div className="continuity-fields">
        <Field label={t('Hospital name')}><input required minLength={2} maxLength={200} value={draft.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label={t('Phone')}><input type="tel" maxLength={30} value={draft.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
      </div>
      <Field label={t('Address')}><input maxLength={300} value={draft.address} onChange={(e) => set('address', e.target.value)} /></Field>
      <Field label={t('Note for patients')}>
        <input maxLength={200} value={draft.note} placeholder={t('For example: maternity ward, open all day')} onChange={(e) => set('note', e.target.value)} />
      </Field>
      <div className="continuity-actions">
        <button className="btn-primary" disabled={busy}>{submit}</button>
        <button type="button" className="btn-secondary" onClick={onCancel}>{t('Cancel')}</button>
      </div>
    </form>
  );
}
