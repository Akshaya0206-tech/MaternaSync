import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ExternalLink, PhoneCall, Star, Volume2 } from 'lucide-react';
import { canSpeak, speak, stopSpeaking } from './speech';
import { patientReferences } from '../../data/patientReferences';
import type { ReferenceTopic } from '../../data/patientReferencesTypes';
import { fetchTopicReviews } from '../../api/topicReviews';
import type { TopicReview, TopicReviews } from '../../api/topicReviews';
import { useAuth } from '../../auth/AuthContext';
import { useLanguage } from '../../i18n';
import { Badge, Empty, Page, Panel } from '../../components/continuity/shared';
import { formatFriendlyDate } from './format';
import { useSavedTopics } from './savedTopics';

const dial = (number: string) => `tel:${number.replace(/[^\d+]/g, '')}`;
const SAVED = '__saved';

/** Trusted pregnancy information a patient can read whenever they need it. Standalone: it does not depend on
 *  anything a doctor approves, and it never shows anything about the patient. Every topic names its official sources.
 *  The only things that come from the server are the dates on which the clinic has reviewed a topic. */
export function ReferencesPage() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const focusId = params.get('topic') ?? '';
  const [text, setText] = useState('');
  const [category, setCategory] = useState('');
  const [reviews, setReviews] = useState<TopicReviews | null>(null); // null: not known (not loaded), which is not the same as "no review"
  const { saved, toggle } = useSavedTopics(user?.id ?? '');
  const { categories, topics, helplines } = patientReferences;

  useEffect(() => {
    fetchTopicReviews().then(setReviews).catch(() => setReviews(null));
  }, []);

  const matches = useMemo(() => {
    const words = text.toLowerCase().split(/\s+/).filter(Boolean);
    return topics.filter((topic) => {
      if (topic.id === focusId) return true; // a link from the companion or from another topic always shows its topic
      if (category === SAVED ? !saved.includes(topic.id) : category && topic.category !== category) return false;
      if (!words.length) return true;
      const haystack = [
        topic.title[language], topic.title.en, topic.summary[language], topic.keyPoints[language].join(' '), topic.seekHelp[language].join(' '), topic.keywords.join(' '),
      ].join(' ').toLowerCase();
      return words.every((word) => haystack.includes(word));
    });
  }, [text, category, topics, language, focusId, saved]);

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
        <button type="button" className="continuity-chip" aria-pressed={category === SAVED} onClick={() => setCategory(category === SAVED ? '' : SAVED)}>{t('Saved ({count})', { count: saved.length })}</button>
        {categories.map((c) => (
          <button key={c.id} type="button" className="continuity-chip" aria-pressed={category === c.id} onClick={() => setCategory(category === c.id ? '' : c.id)}>{c.title[language]}</button>
        ))}
      </div>

      {matches.length === 0 && (
        <Empty>{category === SAVED && !text ? t('You have not saved any topics yet. Tap the star on a topic to keep it here.') : t('Nothing matched. Try one simple word, or choose All topics.')}</Empty>
      )}
      {matches.map((topic) => (
        <Topic key={topic.id} topic={topic} focused={topic.id === focusId} isSaved={saved.includes(topic.id)} onToggleSaved={() => toggle(topic.id)} review={reviews === null ? undefined : reviews[topic.id] ?? false} />
      ))}

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

interface TopicProps {
  topic: ReferenceTopic;
  /** Opened by a link (for example from the care companion): shown open, scrolled into view and highlighted. */
  focused: boolean;
  isSaved: boolean;
  onToggleSaved: () => void;
  /** The clinic's review of this topic; false when nobody has reviewed it; undefined when that could not be loaded. */
  review: TopicReview | false | undefined;
}

function Topic({ topic, focused, isSaved, onToggleSaved, review }: TopicProps) {
  const { t, language } = useLanguage();
  const urgent = topic.id === 'danger-signs';
  const [reading, setReading] = useState<'idle' | 'speaking' | 'no-voice'>('idle');
  const details = useRef<HTMLDetailsElement>(null);
  useEffect(() => () => stopSpeaking(), []); // leaving the page stops the voice
  useEffect(() => {
    if (!focused) return;
    details.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    details.current?.querySelector('summary')?.focus();
  }, [focused]);
  const title = topic.title[language];
  const readAloud = () => {
    if (reading === 'speaking') {
      stopSpeaking();
      setReading('idle');
      return;
    }
    const text = [title, topic.summary[language], ...topic.keyPoints[language], ...(topic.seekHelp[language].length ? [t('Get help quickly if'), ...topic.seekHelp[language]] : [])].join('. ');
    const result = speak(text, language, () => setReading('idle'));
    setReading(result === 'speaking' ? 'speaking' : 'no-voice');
  };
  return (
    <div className="reference-wrap">
      <details ref={details} id={`topic-${topic.id}`} className={`glass-panel continuity-panel reference-topic${urgent ? ' reference-urgent' : ''}${focused ? ' reference-focus' : ''}`} open={urgent || focused}>
        <summary>
          <h2 style={{ display: 'inline' }}>{title}</h2> {urgent && <Badge>{t('Read this first')}</Badge>} {review && <Badge>{t('Reviewed by your clinic')}</Badge>}
          <p className="continuity-muted" style={{ margin: '6px 0 0' }}>{topic.summary[language]}</p>
        </summary>
        {review !== undefined && (
          <p className="continuity-muted reference-review">
            {review
              ? t('Reviewed by your clinic on {date} ({name})', { date: formatFriendlyDate(review.reviewedAt), name: review.reviewerName })
              : t('Not yet reviewed by your clinic. This is general information from official sources.')}
          </p>
        )}
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
        {topic.seeAlso && topic.seeAlso.length > 0 && (
          <>
            <h3>{t('Read next')}</h3>
            <ul className="reference-see-also">
              {topic.seeAlso.map((id) => {
                const other = patientReferences.topics.find((item) => item.id === id);
                return other ? <li key={id}><Link to={`/patient/references?topic=${id}`}>{other.title[language]}</Link></li> : null;
              })}
            </ul>
          </>
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
      <button
        type="button"
        className="reference-save"
        aria-pressed={isSaved}
        aria-label={isSaved ? t('Remove “{title}” from my saved topics', { title }) : t('Save “{title}” to read again', { title })}
        onClick={onToggleSaved}
      >
        <Star size={20} fill={isSaved ? 'currentColor' : 'none'} aria-hidden="true" />
      </button>
    </div>
  );
}
