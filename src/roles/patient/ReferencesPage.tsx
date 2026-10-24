import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, PhoneCall, Volume2 } from 'lucide-react';
import { canSpeak, speak, stopSpeaking } from './speech';
import { patientReferences } from '../../data/patientReferences';
import type { ReferenceTopic } from '../../data/patientReferencesTypes';
import { useLanguage } from '../../i18n';
import { Badge, Empty, Page, Panel } from '../../components/continuity/shared';

const dial = (number: string) => `tel:${number.replace(/[^\d+]/g, '')}`;

/** Trusted pregnancy information a patient can read whenever they need it. Standalone: it does not depend on
 *  anything a doctor approves, and it never shows anything about the patient. Every topic names its official sources. */
export function ReferencesPage() {
  const { t, language } = useLanguage();
  const [text, setText] = useState('');
  const [category, setCategory] = useState('');
  const { categories, topics, helplines } = patientReferences;

  const matches = useMemo(() => {
    const words = text.toLowerCase().split(/\s+/).filter(Boolean);
    return topics.filter((topic) => {
      if (category && topic.category !== category) return false;
      if (!words.length) return true;
      const haystack = [
        topic.title[language], topic.title.en, topic.summary[language], topic.keyPoints[language].join(' '), topic.seekHelp[language].join(' '), topic.keywords.join(' '),
      ].join(' ').toLowerCase();
      return words.every((word) => haystack.includes(word));
    });
  }, [text, category, topics, language]);

  return (
    <Page title={t('References')} subtitle={t('Trusted information about pregnancy to read whenever you need it.')}>
      <div className="continuity-note">
        {t('This is general information from official sources. It does not replace the advice of your own care team. If you are worried about you or your baby, contact your maternity team now.')}{' '}
        <Link to="/patient/emergency">{t('Need help right now? Open Emergency help')}</Link>
      </div>

      <div className="reflib-search" role="search">
        <input type="search" aria-label={t('Search the references')} placeholder={t('Search by a word, for example sugar or baby movements')} value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      <div className="reflib-examples" role="group" aria-label={t('Topic areas')}>
        <button type="button" className="continuity-chip" aria-pressed={category === ''} onClick={() => setCategory('')}>{t('All topics')}</button>
        {categories.map((c) => (
          <button key={c.id} type="button" className="continuity-chip" aria-pressed={category === c.id} onClick={() => setCategory(category === c.id ? '' : c.id)}>{c.title[language]}</button>
        ))}
      </div>

      {matches.length === 0 && <Empty>{t('Nothing matched. Try one simple word, or choose All topics.')}</Empty>}
      {matches.map((topic) => <Topic key={topic.id} topic={topic} />)}

      {helplines.length > 0 && !text && (
        <Panel title={t('Helplines')} aside={<PhoneCall size={18} aria-hidden="true" />}>
          <p className="continuity-muted">{t('Which numbers work, and who answers, can differ from state to state.')}</p>
          <div className="emergency-numbers">
            {helplines.map((h) => (
              <a key={h.number} className="emergency-call" href={dial(h.number)}>
                <strong>{h.number}</strong>
                <span>{h.label[language]}</span>
                <span className="continuity-muted">{h.note[language]}</span>
              </a>
            ))}
          </div>
        </Panel>
      )}
    </Page>
  );
}

function Topic({ topic }: { topic: ReferenceTopic }) {
  const { t, language } = useLanguage();
  const urgent = topic.id === 'danger-signs';
  const [reading, setReading] = useState<'idle' | 'speaking' | 'no-voice'>('idle');
  useEffect(() => () => stopSpeaking(), []); // leaving the page stops the voice
  const readAloud = () => {
    if (reading === 'speaking') {
      stopSpeaking();
      setReading('idle');
      return;
    }
    const text = [topic.title[language], topic.summary[language], ...topic.keyPoints[language], ...(topic.seekHelp[language].length ? [t('Get help quickly if'), ...topic.seekHelp[language]] : [])].join('. ');
    const result = speak(text, language, () => setReading('idle'));
    setReading(result === 'speaking' ? 'speaking' : 'no-voice');
  };
  return (
    <details className={`glass-panel continuity-panel reference-topic${urgent ? ' reference-urgent' : ''}`} open={urgent}>
      <summary>
        <h2 style={{ display: 'inline' }}>{topic.title[language]}</h2> {urgent && <Badge>{t('Read this first')}</Badge>}
        <p className="continuity-muted" style={{ margin: '6px 0 0' }}>{topic.summary[language]}</p>
      </summary>
      {canSpeak() && (
        <div className="continuity-actions">
          <button type="button" className="btn-secondary" aria-pressed={reading === 'speaking'} onClick={readAloud}>
            <Volume2 size={14} aria-hidden="true" /> {reading === 'speaking' ? t('Stop reading') : t('Read aloud')}
          </button>
        </div>
      )}
      {reading === 'no-voice' && <p role="status" className="continuity-muted">{t('Your device has no voice installed for this language.')}</p>}
      {topic.keyPoints[language].length > 0 && (
        <>
          <h3>{t('The main points')}</h3>
          <ul>{topic.keyPoints[language].map((point, index) => <li key={index}>{point}</li>)}</ul>
        </>
      )}
      {topic.seekHelp[language].length > 0 && (
        <div className="continuity-note reference-help">
          <h3>{t('Get help quickly if')}</h3>
          <ul>{topic.seekHelp[language].map((point, index) => <li key={index}>{point}</li>)}</ul>
        </div>
      )}
      <h3>{t('Where this comes from')}</h3>
      <ul className="reference-sources">
        {topic.sources.map((source) => (
          <li key={source.url}>
            <a href={source.url} target="_blank" rel="noreferrer">{source.label} <ExternalLink size={13} aria-hidden="true" /></a>
            <span className="continuity-muted"> · {source.publisher}</span>
          </li>
        ))}
      </ul>
      <p className="continuity-muted">{t('These links open official websites, which may be in English.')}</p>
    </details>
  );
}
