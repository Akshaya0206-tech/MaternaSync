import { useCallback, useEffect, useState } from 'react';
import { Copy, UserPlus } from 'lucide-react';
import { inviteTrusted, listTrusted, newInviteCode, removeTrusted, trustedActivity, updateTrusted } from '../../api/caregiver';
import type { Permission, Permissions, TrustedActivity, TrustedPerson } from '../../api/caregiver';
import { formatTime } from '../../api/continuity';
import { tx, useLanguage } from '../../i18n';
import { Badge, Feedback, Field, useAction } from '../../components/continuity/shared';

// Each thing she can allow, in the first person. Only the first is on unless she chooses more.
const OPTIONS: { key: Permission; label: string }[] = [
  { key: 'appointments', label: tx('See my appointments') },
  { key: 'check_in', label: tx('See my daily check-ins and fill one in with me') },
  { key: 'care_plan', label: tx('Read the summaries and instructions my doctor has released to me') },
  { key: 'questions', label: tx('Ask the clinic a question, and read the replies') },
  { key: 'emergency', label: tx('See my emergency numbers, my emergency contact and my preferred hospital') },
];
const DEFAULTS: Permissions = { appointments: true, check_in: false, care_plan: false, questions: false, emergency: false };
const STATUS: Record<TrustedPerson['status'], string> = { INVITED: tx('Waiting to join'), ACTIVE: tx('Active'), REVOKED: tx('Removed') };

function PermissionBoxes({ value, onChange, name, disabled }: { value: Permissions; onChange: (next: Permissions) => void; name: string; disabled?: boolean }) {
  const { t } = useLanguage();
  return (
    <fieldset className="trusted-permissions" disabled={disabled}>
      <legend>{t('What they may do')}</legend>
      {OPTIONS.map((option) => (
        <label key={option.key} className="trusted-permission">
          <input type="checkbox" name={`${name}-${option.key}`} checked={value[option.key]} onChange={(e) => onChange({ ...value, [option.key]: e.target.checked })} />
          <span>{t(option.label)}</span>
        </label>
      ))}
    </fieldset>
  );
}

/** Profile → Trusted people. The woman invites a relative or friend, chooses exactly what they may do, sees what they did, and can remove them at any time. */
export function TrustedPeopleCard() {
  const { t } = useLanguage();
  const action = useAction();
  const [people, setPeople] = useState<TrustedPerson[] | null>(null);
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [permissions, setPermissions] = useState<Permissions>(DEFAULTS);
  // The invite code is only ever shown right after it is made: the server keeps just a scrambled copy.
  const [issued, setIssued] = useState<{ name: string; code: string; expires: string | null } | null>(null);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState('');
  const [activity, setActivity] = useState<TrustedActivity[] | null>(null); // null while it is loading

  // A new account has no pregnancy record until the clinic links one, and a trusted person is linked to that record.
  const [unavailable, setUnavailable] = useState(false);
  const load = useCallback(async () => { setPeople((await listTrusted()).items); }, []);
  useEffect(() => { load().catch(() => { setPeople([]); setUnavailable(true); }); }, [load]);

  // The tick changes at once and the save follows; if the save fails the list is loaded again, which puts the real setting back.
  const changePermissions = (person: TrustedPerson, next: Permissions) => {
    setPeople((current) => current && current.map((p) => (p.id === person.id ? { ...p, permissions: next } : p)));
    void action.run(async () => {
      try {
        await updateTrusted(person.id, { permissions: next });
      } catch (err) {
        await load();
        throw err;
      }
      await load();
    }, t('Saved. This applies straight away.'));
  };

  const show = (person: TrustedPerson, code: string) => { setIssued({ name: person.displayName, code, expires: person.inviteExpiresAt }); setCopied(false); };
  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false); // she can still read the code and type it
    }
  };

  const invite = (e: React.FormEvent) => {
    e.preventDefault();
    void action.run(async () => {
      const made = await inviteTrusted({ displayName: name, relationship, permissions });
      show(made, made.code ?? '');
      setName(''); setRelationship(''); setPermissions(DEFAULTS);
      await load();
    }, t('Invite made. Give them the code below.'));
  };

  return (
    <section className="glass-panel trusted-card" aria-labelledby="trusted-heading" id="trusted" style={{ padding: '20px 24px', marginTop: '16px' }}>
      <h2 id="trusted-heading" style={{ fontSize: '1rem', margin: '0 0 6px 0' }}>{t('Trusted people')}</h2>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 12px 0' }}>
        {t('Invite a relative or friend to help you. They get their own login. You choose what they can see and do, you can see what they did, and you can remove them at any time.')}
      </p>
      <Feedback error={action.error} message={action.message} />

      {issued && (
        <div className="continuity-note trusted-code" role="status">
          <p style={{ margin: 0 }}>{t('Invite code for {name}', { name: issued.name })}</p>
          <p className="trusted-code-value" aria-label={t('Invite code')}>{issued.code}</p>
          <button type="button" className="btn-secondary" onClick={() => void copy(issued.code)}><Copy size={15} aria-hidden="true" /> {copied ? t('Copied') : t('Copy code')}</button>
          <p style={{ margin: '8px 0 0' }}>
            {t('This code works once and stops working after 48 hours. We cannot show it again, but you can make a new one. They sign up, choose “Family member or trusted person” as the role, and enter the code.')}
          </p>
        </div>
      )}

      {people === null && <p role="status" className="continuity-muted">{t('Loading…')}</p>}
      {unavailable && <p className="continuity-empty">{t('You can invite someone once your clinic has linked your pregnancy record.')}</p>}
      {people?.length === 0 && !unavailable && <p className="continuity-empty">{t('You have not invited anyone yet.')}</p>}
      {people?.map((person) => (
        <article key={person.id} className="continuity-item trusted-person">
          <h3>
            {person.displayName}{person.relationship ? ` · ${person.relationship}` : ''} <Badge>{t(STATUS[person.status])}</Badge>
          </h3>
          {person.status === 'ACTIVE' && (
            <p className="continuity-muted">
              {person.caregiverName ? `${person.caregiverName}` : ''}{person.acceptedAt ? ` · ${t('Joined')} ${formatTime(person.acceptedAt)}` : ''}
              {person.lastActivity ? ` · ${t('Last used')} ${formatTime(person.lastActivity)}` : ''}
            </p>
          )}
          {person.status === 'INVITED' && <p className="continuity-muted">{t('Waiting to join. The invite stops working on {when}.', { when: formatTime(person.inviteExpiresAt) })}</p>}
          {person.status === 'REVOKED' && <p className="continuity-muted">{t('Removed on {when}. They can no longer see anything.', { when: formatTime(person.revokedAt) })}</p>}

          {person.status !== 'REVOKED' && (
            <>
              <PermissionBoxes
                name={person.id}
                value={person.permissions}
                onChange={(next) => changePermissions(person, next)}
              />
              <div className="continuity-actions">
                {person.status === 'INVITED' && (
                  <button type="button" className="btn-secondary" disabled={action.busy}
                    onClick={() => void action.run(async () => { const again = await newInviteCode(person.id); show(again, again.code ?? ''); await load(); }, t('A new code was made. The old one no longer works.'))}>
                    {t('Make a new code')}
                  </button>
                )}
                {person.status === 'ACTIVE' && (
                  <button type="button" className="btn-secondary" aria-expanded={open === person.id}
                    onClick={() => {
                      if (open === person.id) { setOpen(''); return; }
                      setOpen(person.id);
                      setActivity(null);
                      trustedActivity(person.id).then(setActivity).catch(() => setActivity([]));
                    }}>
                    {open === person.id ? t('Hide what they did') : t('See what they did')}
                  </button>
                )}
                <button type="button" className="btn-secondary danger-action" disabled={action.busy}
                  onClick={() => {
                    if (!window.confirm(t('Remove {name}? They will lose access straight away.', { name: person.displayName }))) return;
                    void action.run(async () => { await removeTrusted(person.id); setOpen(''); await load(); }, t('Removed. They can no longer see anything.'));
                  }}>
                  {t('Remove')}
                </button>
              </div>
              {open === person.id && (
                <ul className="continuity-list" aria-label={t('What they did')}>
                  {activity === null && <li className="continuity-muted">{t('Loading…')}</li>}
                  {activity?.length === 0 && <li className="continuity-muted">{t('They have not done anything yet.')}</li>}
                  {activity?.map((row, index) => <li key={index}>{formatTime(row.at)} · {row.title}{row.details ? ` (${row.details})` : ''}</li>)}
                </ul>
              )}
            </>
          )}
        </article>
      ))}

      {!unavailable && <form onSubmit={invite} className="trusted-invite">
        <h3 style={{ fontSize: '0.92rem', margin: '16px 0 8px' }}>{t('Invite someone')}</h3>
        <div className="continuity-fields">
          <Field label={t('Their name')}><input required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" /></Field>
          <Field label={t('How are they related to you?')}><input maxLength={40} value={relationship} onChange={(e) => setRelationship(e.target.value)} placeholder={t('For example husband or mother')} autoComplete="off" /></Field>
        </div>
        <PermissionBoxes name="new" value={permissions} onChange={setPermissions} />
        <button className="btn-primary" disabled={action.busy || !name.trim()}><UserPlus size={15} aria-hidden="true" /> {t('Make an invite code')}</button>
      </form>}
    </section>
  );
}
