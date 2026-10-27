import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useLanguage } from '../../i18n';
import { Empty, Page, Panel } from '../../components/continuity/shared';
import { SecurityCard } from '../patient/AccountCards';
import '../patient/profile.css';
import { CaregiverWhatsAppCard } from './CaregiverWhatsApp';
import { useCaregiver } from './CaregiverContext';

/** Profile: who they are signed in as, how each woman lists them (she chooses it, they can only read it), their WhatsApp reminders and number, and
 *  the same Security card as the woman's own Profile (change the password, sign out other devices). */
export function CaregiverProfilePage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { women, current } = useCaregiver();
  const { hash } = useLocation();

  useEffect(() => {
    if (hash === '#whatsapp') document.getElementById('whatsapp')?.scrollIntoView();
  }, [hash, current?.linkId]);

  return (
    <Page title={t('Profile')} subtitle={t('Your account, how each woman lists you, and your WhatsApp reminders.')}>
      <Panel title={t('You')}>
        <p><strong>{user?.fullName}</strong></p>
        <p className="continuity-muted">{t('Trusted person')} · {user?.email}</p>
      </Panel>

      <Panel title={t('How you are listed')}>
        {women === null && <p role="status" className="continuity-muted">{t('Loading…')}</p>}
        {women && !women.length && <Empty>{t('You are not looking after anyone right now.')}</Empty>}
        {women?.map((w) => (
          <article key={w.linkId} className="continuity-item">
            <h3>{w.womanName}</h3>
            <p>{w.relationship ? t('She lists you as: {name} · {relationship}', { name: w.displayName, relationship: w.relationship }) : t('She lists you as: {name}', { name: w.displayName })}</p>
          </article>
        ))}
        {!!women?.length && <p className="continuity-muted">{t('She chooses this. Ask her if it should change.')}</p>}
      </Panel>

      {current && !current.ended && (
        <section id="whatsapp">
          {(women?.length ?? 0) > 1 && <p className="continuity-note">{t('This is for {name}. Choose another woman at the top of the page to change hers.', { name: current.womanName })}</p>}
          <CaregiverWhatsAppCard linkId={current.linkId} womanName={current.womanName} />
        </section>
      )}

      <SecurityCard index={0} />
    </Page>
  );
}
