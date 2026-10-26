import { useState } from 'react';
import { Eye } from 'lucide-react';
import { fetchConsentPreview } from '../../api/updates';
import type { ConsentPreview as Preview, ConsentPurpose } from '../../api/updates';
import { useLanguage } from '../../i18n';

/** Shows the message a recipient would get for the chosen purpose before she saves the permission. The text comes from the server, from the same
 *  function that words the real messages, in her language. */
export function ConsentPreview({ purpose }: { purpose: string }) {
  const { t } = useLanguage();
  const [shown, setShown] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const show = async () => {
    setBusy(true);
    setFailed(false);
    try {
      setShown(await fetchConsentPreview(purpose as ConsentPurpose));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="consent-preview">
      <button type="button" className="btn-secondary" disabled={busy} onClick={() => void show()}>
        <Eye size={15} aria-hidden="true" /> {t('Preview the message')}
      </button>
      <div aria-live="polite">
        {failed && <p className="continuity-muted">{t('We could not show the message. Please try again.')}</p>}
        {/* A preview belongs to the purpose it was made for; choosing another purpose hides it until it is asked for again. */}
        {shown && shown.purpose === purpose && (
          <figure>
            <figcaption>{t('This is the message the person would get.')}</figcaption>
            <blockquote lang={shown.language}>{shown.text}</blockquote>
            {shown.viaTemplate && <p className="continuity-muted">{t('Your clinic sends this through a message template approved with WhatsApp. Its wording is set there; this is the text MaternaSync prepares.')}</p>}
          </figure>
        )}
      </div>
    </div>
  );
}
