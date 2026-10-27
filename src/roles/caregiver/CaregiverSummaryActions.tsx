import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Volume2 } from 'lucide-react';
import type { ClinicalOutput } from '../../api/continuity';
import { useLanguage } from '../../i18n';
import { canSpeak, speak, stopSpeaking } from '../patient/speech';

/** What is read out: the same words that are on the screen for this summary. */
const readable = (output: ClinicalOutput): string => {
  const sections = Object.entries(output.structuredData ?? {}).filter(([, value]) => value.trim()).map(([heading, value]) => `${heading}. ${value}`);
  return [output.title, output.content, ...sections].filter(Boolean).join('. ');
};

/** Under each released summary: Read aloud (with the voices on the person's own device, in the language the summary is written in) and, when she has allowed
 *  questions, a link that opens Questions with the box started for them. The box gets only the summary's TITLE, never its words. */
export function CaregiverSummaryActions({ output, canAsk }: { output: ClinicalOutput; canAsk: boolean }) {
  const { t } = useLanguage();
  const [reading, setReading] = useState<'idle' | 'speaking' | 'no-voice'>('idle');
  useEffect(() => () => stopSpeaking(), []); // leaving the page stops the voice

  const readAloud = () => {
    if (reading === 'speaking') {
      stopSpeaking();
      setReading('idle');
      return;
    }
    const result = speak(readable(output), output.language, () => setReading('idle'));
    setReading(result === 'speaking' ? 'speaking' : 'no-voice');
  };
  const draft = `${t('About “{title}”:', { title: output.title.slice(0, 100) })} `;

  if (!canSpeak() && !canAsk) return null;
  return (
    <>
      <div className="continuity-actions">
        {canSpeak() && (
          <button type="button" className="btn-secondary" aria-pressed={reading === 'speaking'} onClick={readAloud}>
            <Volume2 size={14} aria-hidden="true" /> {reading === 'speaking' ? t('Stop reading') : t('Read aloud')}
          </button>
        )}
        {canAsk && (
          <Link className="btn-secondary" to={`/caregiver/questions?draft=${encodeURIComponent(draft)}`}>
            <MessageCircle size={14} aria-hidden="true" /> {t('Ask the doctor about this')}
          </Link>
        )}
      </div>
      {reading === 'no-voice' && <p role="status" className="continuity-muted">{t('Your device has no voice installed for this language.')}</p>}
    </>
  );
}
