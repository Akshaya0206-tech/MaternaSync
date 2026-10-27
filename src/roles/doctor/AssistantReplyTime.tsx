import { useEffect, useState } from 'react';
import { getReplyTime, saveReplyTime } from '../../api/assistant';
import { Feedback, Field, useAction } from '../../components/continuity/shared';
import { PanelOrFold } from './FoldPanel';
import type { Fold } from './FoldPanel';
import { useLanguage } from '../../i18n';

/** The usual reply time patients see on their My Questions page, for example "within 1 working day". A doctor sets it for the clinic. */
export function AssistantReplyTime({ fold }: { fold?: Fold } = {}) {
  const { t } = useLanguage();
  const action = useAction();
  const [text, setText] = useState('');
  const [mostChars, setMostChars] = useState(100);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getReplyTime()
      .then((reply) => { setText(reply.text); setMostChars(reply.mostChars); })
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) return null;

  const save = () =>
    action.run(async () => {
      const saved = await saveReplyTime(text.trim());
      setText(saved.text);
    }, t('Reply time saved.'));

  return (
    <PanelOrFold title={t('Usual reply time')} fold={fold}>
      <Feedback error={action.error} message={action.message} />
      <p className="continuity-muted">
        {t('Patients see this on their My Questions page. It is only a guide to when a reply usually comes. It promises nothing, and anything urgent is sent to the emergency numbers.')}
      </p>
      <Field label={t('How long a reply usually takes')}>
        <input value={text} maxLength={mostChars} placeholder={t('For example: within 1 working day')} onChange={(e) => setText(e.target.value)} />
      </Field>
      <p className="continuity-muted">{t('Leave it empty to show nothing.')}</p>
      <div className="continuity-actions">
        <button className="btn-primary" disabled={action.busy} onClick={() => void save()}>{t('Save reply time')}</button>
      </div>
    </PanelOrFold>
  );
}
