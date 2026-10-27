import { useEffect, useRef, useState } from 'react';
import { stopHelping } from '../../api/caregiverHome';
import { Feedback, Panel, useAction } from '../../components/continuity/shared';
import { useLanguage } from '../../i18n';
import { useCaregiver } from './CaregiverContext';

/** Leaving: a person can stop helping a woman at any time. It takes two steps, in the page (no pop-up), and says what will happen. She is told, and
 *  can invite them again later with a new code. */
export function StopHelpingCard({ linkId, womanName }: { linkId: string; womanName: string }) {
  const { t } = useLanguage();
  const { reload } = useCaregiver();
  const action = useAction();
  const [asking, setAsking] = useState(false);
  const question = useRef<HTMLDivElement>(null);
  const first = womanName.split(' ')[0];

  useEffect(() => {
    if (asking) question.current?.focus();
  }, [asking]);

  return (
    <Panel title={t('Stop helping {name}', { name: first })}>
      {!asking ? (
        <>
          <p>{t('If you no longer want to help {name}, you can stop here. You will not see anything about her afterwards.', { name: first })}</p>
          <button type="button" className="btn-secondary danger-action" onClick={() => setAsking(true)}>{t('Stop helping {name}…', { name: first })}</button>
        </>
      ) : (
        <div ref={question} tabIndex={-1} role="group" aria-labelledby="stop-helping-question" className="stop-helping-confirm">
          <h3 id="stop-helping-question">{t('Stop helping {name}?', { name: first })}</h3>
          <ul className="continuity-list">
            <li>{t('You will no longer see anything about her in MaternaSync, and your WhatsApp reminders about her stop.')}</li>
            <li>{t('She is told that you stopped.')}</li>
            <li>{t('She can invite you again later, with a new code.')}</li>
          </ul>
          <Feedback error={action.error} />
          <div className="continuity-actions">
            <button
              type="button"
              className="btn-primary"
              disabled={action.busy}
              onClick={() => void action.run(async () => {
                try {
                  await stopHelping(linkId);
                } finally {
                  await reload(); // either way, show what is true now: she may already have removed them
                }
              }, '')}
            >
              {t('Yes, stop helping {name}', { name: first })}
            </button>
            <button type="button" className="btn-secondary" disabled={action.busy} onClick={() => setAsking(false)}>{t('No, keep helping')}</button>
          </div>
        </div>
      )}
    </Panel>
  );
}
