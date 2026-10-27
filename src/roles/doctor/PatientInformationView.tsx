import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { clearTopicReview, fetchDoctorTopicReviews, markTopicReviewed, markTopicsReviewed, reviewState } from '../../api/topicReviews';
import type { ReviewState, TopicReviews } from '../../api/topicReviews';
import { patientReferences } from '../../data/patientReferences';
import type { ReferenceTopic } from '../../data/patientReferencesTypes';
import { topicFingerprints } from '../../data/topicFingerprints';
import { formatTime } from '../../api/continuity';
import { Badge, Feedback, Field, Panel, useAction } from '../../components/continuity/shared';
import { useLanguage } from '../../i18n';

/** The doctor's "Patient information" tab (Doctor -> References): the topics on the patient References page, with the clinic's review of each.
 *  Reviewing a topic does not change it. It only lets patients see that the clinic has read it, and who and when. A review keeps a fingerprint of the
 *  text that was read: if the text changes later, the topic shows "Changed since reviewed" here, and patients are told it was updated. */
export function PatientInformationView() {
  const { t } = useLanguage();
  const action = useAction();
  const [reviews, setReviews] = useState<TopicReviews>({});
  const [loaded, setLoaded] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const { topics, categories } = patientReferences;
  const prints = topicFingerprints();
  const stateOf = (topic: ReferenceTopic): ReviewState => reviewState(reviews[topic.id], prints[topic.id]);
  const reviewed = topics.filter((topic) => ['current', 'untracked'].includes(stateOf(topic))).length;
  const changed = topics.filter((topic) => stateOf(topic) === 'changed').length;
  // "Not reviewed" for the bulk button means: no review stands for the text as it is now (never reviewed, or changed since).
  const needReview = topics.filter((topic) => ['none', 'changed'].includes(stateOf(topic))).map((topic) => topic.id);
  const chosen = picked.filter((id) => topics.some((topic) => topic.id === id));

  const load = async () => {
    try {
      setReviews(await fetchDoctorTopicReviews());
    } finally {
      setLoaded(true);
    }
  };
  useEffect(() => {
    void action.run(load, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (id: string, on: boolean) => {
    setConfirming(false);
    setPicked((old) => (on ? [...old.filter((item) => item !== id), id] : old.filter((item) => item !== id)));
  };

  return (
    <>
      <Feedback error={action.error} message={action.message} />
      <div className="continuity-note">
        {t('This is the text patients read on their References page. It was written in plain language from official sources and is the same for every patient. Reviewing a topic here does not change it: it only shows patients that your clinic has read it, and who and when. The Hindi, Tamil and Telugu wording still needs a native speaker’s review, which marking a topic does not cover.')}
      </div>
      <div className="continuity-note">
        {t('A review remembers the English text you read. If that text changes later, the topic shows “Changed since reviewed” here, and patients see “Updated since your clinic last reviewed it” until you mark it as reviewed again.')}
      </div>
      <p className="continuity-muted" role="status">
        {loaded ? t('{done} of {total} topics reviewed, {changed} changed since reviewed', { done: reviewed, total: topics.length, changed }) : t('Loading…')}
      </p>
      {loaded && (
        <div className="patient-info-bulk" role="group" aria-label={t('Mark several topics at once')}>
          <button type="button" className="btn-secondary" disabled={!needReview.length} onClick={() => { setConfirming(false); setPicked(needReview); }}>
            {t('Select all not reviewed ({count})', { count: needReview.length })}
          </button>
          <button type="button" className="btn-secondary" disabled={!chosen.length} onClick={() => { setConfirming(false); setPicked([]); }}>
            {t('Select none')}
          </button>
          <button type="button" className="btn-primary" disabled={!chosen.length || action.busy} aria-expanded={confirming} onClick={() => setConfirming(true)}>
            {t('Mark selected as reviewed ({count})', { count: chosen.length })}
          </button>
        </div>
      )}
      {confirming && chosen.length > 0 && (
        <div className="continuity-note patient-info-confirm" role="alert">
          <p>{t('Mark {count} selected as reviewed? Your name and today’s date will show to patients on each of them. Private notes stay as they are.', { count: chosen.length })}</p>
          <div className="continuity-actions">
            <button
              type="button"
              className="btn-primary"
              disabled={action.busy}
              onClick={() => void action.run(async () => {
                await markTopicsReviewed(chosen.map((id) => ({ topicId: id, contentHash: prints[id] })));
                setPicked([]);
                setConfirming(false);
                await load();
              }, t('Marked {count} topics as reviewed.', { count: chosen.length }))}
            >
              {t('Yes, mark them as reviewed')}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setConfirming(false)}>{t('Cancel')}</button>
          </div>
        </div>
      )}
      {loaded && categories.map((category) => (
        <Panel key={category.id} title={category.title.en}>
          {topics.filter((topic) => topic.category === category.id).map((topic) => (
            <TopicRow
              key={topic.id}
              topic={topic}
              reviews={reviews}
              state={stateOf(topic)}
              fingerprint={prints[topic.id]}
              selected={chosen.includes(topic.id)}
              onSelect={(on) => toggle(topic.id, on)}
              busy={action.busy}
              onChange={async (work, done) => { await action.run(async () => { await work(); await load(); }, done); }}
            />
          ))}
        </Panel>
      ))}
    </>
  );
}

interface RowProps {
  topic: ReferenceTopic;
  reviews: TopicReviews;
  state: ReviewState;
  fingerprint: string;
  selected: boolean;
  onSelect: (on: boolean) => void;
  busy: boolean;
  onChange: (work: () => Promise<unknown>, done: string) => Promise<void>;
}

function TopicRow({ topic, reviews, state, fingerprint, selected, onSelect, busy, onChange }: RowProps) {
  const { t } = useLanguage();
  const review = reviews[topic.id];
  const [note, setNote] = useState('');
  const who = review ? t('Reviewed by {name} on {date}', { name: review.reviewerName, date: formatTime(review.reviewedAt) }) : '';
  return (
    <article className={`continuity-item patient-info-row${state === 'changed' ? ' patient-info-changed' : ''}`}>
      <label className="continuity-check patient-info-pick">
        <input type="checkbox" checked={selected} onChange={(e) => onSelect(e.target.checked)} aria-label={t('Select “{title}”', { title: topic.title.en })} />
      </label>
      <h3>
        {topic.title.en}{' '}
        {state === 'none' && <Badge>{t('Not reviewed')}</Badge>}
        {(state === 'current' || state === 'untracked') && <Badge>{t('Reviewed')}</Badge>}
        {state === 'changed' && <Badge>{t('Changed since reviewed')}</Badge>}
      </h3>
      <p className="continuity-muted">
        {state === 'none' && t('Patients see: “Not yet reviewed by your clinic.”')}
        {(state === 'current' || state === 'untracked') && who + (review?.note ? ` · ${review.note}` : '')}
        {state === 'changed' && `${who}. ${t('The text has changed since then. Patients now see: “Updated since your clinic last reviewed it.”')}` + (review?.note ? ` · ${review.note}` : '')}
      </p>
      {state === 'untracked' && <p className="continuity-muted">{t('Reviewed before change tracking: mark again to track changes.')}</p>}
      <details>
        <summary>{t('Read the text')}</summary>
        <p>{topic.summary.en}</p>
        <h4>{t('The main points')}</h4>
        <ul>{topic.keyPoints.en.map((point, index) => <li key={index}>{point}</li>)}</ul>
        {topic.seekHelp.en.length > 0 && (
          <>
            <h4>{t('Get help quickly if')}</h4>
            <ul>{topic.seekHelp.en.map((point, index) => <li key={index}>{point}</li>)}</ul>
          </>
        )}
        <h4>{t('Where this comes from')}</h4>
        <ul>
          {topic.sources.map((source) => (
            <li key={source.url}>
              <a href={source.url} target="_blank" rel="noreferrer">{source.label} <ExternalLink size={13} aria-hidden="true" /></a>
              <span className="continuity-muted"> · {source.publisher}</span>
            </li>
          ))}
        </ul>
      </details>
      <Field label={t('Note (optional, shown only to doctors)')}>
        <input maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <div className="continuity-actions">
        <button type="button" className="btn-primary" disabled={busy} onClick={() => void onChange(async () => { await markTopicReviewed(topic.id, note, fingerprint); setNote(''); }, t('Marked as reviewed.'))}>
          {state === 'none' ? t('Mark as reviewed') : t('Mark as reviewed again')}
        </button>
        {review && (
          <button type="button" className="btn-secondary" disabled={busy} onClick={() => void onChange(() => clearTopicReview(topic.id), t('Review cleared.'))}>
            {t('Clear the review')}
          </button>
        )}
      </div>
    </article>
  );
}
