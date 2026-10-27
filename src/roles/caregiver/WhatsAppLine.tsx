import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { caregiverWhatsApp } from '../../api/caregiver';
import type { CaregiverWhatsAppStatus } from '../../api/caregiver';
import { Panel } from '../../components/continuity/shared';
import { useLanguage } from '../../i18n';

/** One line on Home about the WhatsApp reminders. Turning them on or off, and the number, are on Profile. Nothing is shown when she has not allowed
 *  anything to be reminded about, or the server cannot send WhatsApp. */
export function WhatsAppLine({ linkId }: { linkId: string }) {
  const { t } = useLanguage();
  const [status, setStatus] = useState<CaregiverWhatsAppStatus | null>(null);

  useEffect(() => {
    setStatus(null);
    caregiverWhatsApp(linkId).then(setStatus).catch(() => setStatus(null));
  }, [linkId]);

  if (!status || !status.available || (!status.visits && !status.checkIns)) return null;
  const on = status.status === 'on';
  return (
    <Panel title={t('WhatsApp reminders')}>
      <p>
        {on
          ? t('WhatsApp reminders are on for {number}.', { number: status.number ?? '' })
          : status.status === 'waiting'
            ? t('WhatsApp reminders: waiting for the code we sent you.')
            : t('WhatsApp reminders are off.')}
      </p>
      <Link className="btn-secondary" to="/caregiver/profile#whatsapp">
        {on ? t('Change in Profile') : status.status === 'waiting' ? t('Finish in Profile') : t('Turn on in Profile')}
      </Link>
    </Panel>
  );
}
