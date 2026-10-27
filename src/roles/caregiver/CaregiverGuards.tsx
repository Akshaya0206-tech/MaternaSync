import type { ReactNode } from 'react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { acceptInvite } from '../../api/caregiver';
import type { Permission } from '../../api/caregiver';
import { useLanguage } from '../../i18n';
import { Feedback, Field, Page, Panel, useAction } from '../../components/continuity/shared';
import { formatFriendlyDate } from '../patient/format';
import { useCaregiver } from './CaregiverContext';

/** Shown instead of a page when the end date she set has passed. The server refuses the requests too; this explains why. */
export function EndedNotice({ title }: { title: string }) {
  const { t } = useLanguage();
  const { current } = useCaregiver();
  return (
    <Page title={title}>
      <Panel title={t('Your access has ended')}>
        <p>{t('{name} set an end date for your access, and it has passed ({date}). Ask her to extend it from her Profile page. Nothing about her is shown until she does.', { name: current?.womanName ?? '', date: formatFriendlyDate(current?.accessUntil) })}</p>
        <p className="continuity-muted">{t('If you look after someone else too, choose her from the menu.')}</p>
      </Panel>
    </Page>
  );
}

/** Wraps a page that needs a permission: shows a plain explanation, not an error, if she has not allowed it. */
export function Needs({ permission, title, children }: { permission: Permission; title: string; children: (linkId: string) => ReactNode }) {
  const { t } = useLanguage();
  const { women, current, can } = useCaregiver();
  if (women === null) return <Page title={title}><p role="status" className="continuity-muted">{t('Loading…')}</p></Page>;
  if (!current) return <NotLinked title={title} />;
  if (current.ended) return <EndedNotice title={title} />;
  if (!can(permission)) {
    return (
      <Page title={title}>
        <Panel title={t('She has not allowed this')}>
          <p>{t('{name} has not allowed you to use this page. You can ask her to change it if you need it.', { name: current.womanName })}</p>
          <Link className="btn-secondary" to="/caregiver/home">{t('Back to Home')}</Link>
        </Panel>
      </Page>
    );
  }
  return <>{children(current.linkId)}</>;
}

export function JoinForm() {
  const { t } = useLanguage();
  const { reload, select } = useCaregiver();
  const action = useAction();
  const [code, setCode] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void action.run(async () => {
          const joined = await acceptInvite(code);
          setCode('');
          await reload();
          select(joined.linkId);
        }, t('You can now see what she has allowed.'));
      }}
    >
      <Feedback error={action.error} message={action.message} />
      <Field label={t('Invite code')}>
        <input required value={code} onChange={(e) => setCode(e.target.value)} placeholder="ABCD-2345" autoComplete="off" autoCapitalize="characters" spellCheck={false} />
      </Field>
      <button className="btn-primary" disabled={action.busy}>{t('Join')}</button>
    </form>
  );
}

export function NotLinked({ title }: { title: string }) {
  const { t } = useLanguage();
  return (
    <Page title={title}>
      <Panel title={t('You are not looking after anyone right now')}>
        <p>{t('A woman can remove you at any time. If she has made you a new invite, enter its code here.')}</p>
        <JoinForm />
      </Panel>
    </Page>
  );
}
