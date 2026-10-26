import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { clearTopicReview, fetchDoctorTopicReviews, markTopicReviewed } from '../../api/topicReviews';
import type { TopicReviews } from '../../api/topicReviews';
import { patientReferences } from '../../data/patientReferences';
import type { ReferenceTopic } from '../../data/patientReferencesTypes';
import { formatTime } from '../../api/continuity';
import { Badge, Feedback, Field, Panel, useAction } from '../../components/continuity/shared';
import { useLanguage } from '../../i18n';

/** The doctor's "Patient information" tab (Doctor -> References): the topics on the patient References page, with the clinic's review of each.
 *  Reviewing a topic does not change it. It only lets patients see that the clinic has read it, and who and when. */
export function PatientInformationView() {
  const { t } = useLanguage();
  const action = useAction();
  const [reviews, setReviews] = useState<TopicReviews>({});
  const [loaded, setLoaded] = useState(false);
  const { topics, categories } = patientReferences;
  const reviewed = topics.filter((topic) => reviews[topic.id]).length;

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

  return (
    <>
      <Feedback error={action.error} message={action.message} />
      <div className="continuity-note">
        {t('This is the text patients read on their References page. It was written in plain language from official sources and is the same for every patient. Reviewing a topic here does not change it: it only shows patients that your clinic has read it, and who and when. The Hindi, Tamil and Telugu wording still needs a native speaker’s review, which marking a topic does not cover.')}
      </div>
      <p className="continuity-muted" role="status">{loaded ? t('{done} of {total} topics reviewed', { done: reviewed, total: topics.length }) : t('Loading…')}</p>
      {loaded && categories.map((category) => (
        <Panel key={category.id} title={category.title.en}>
          {topics.filter((topic) => topic.category === category.id).map((topic) => (
            <TopicRow key={topic.id} topic={topic} reviews={reviews} busy={action.busy} onChange={async (work, done) => { await action.run(async () => { await work(); await load(); }, done); }} />
          ))}
        </Panel>
      ))}
    </>
  );
}

function TopicRow({ topic, reviews, busy, onChange }: { topic: ReferenceTopic; reviews: TopicReviews; busy: boolean; onChange: (work: () => Promise<unknown>, done: string) => Promise<void> }) {
  const { t } = useLanguage();
  const review = reviews[topic.id];
  const [note, setNote] = useState('');
  return (
    <article className="continuity-item patient-info-row">
      <h3>
        {topic.title.en} {review ? <Badge>{t('Reviewed')}</Badge> : <Badge>{t('Not reviewed')}</Badge>}
      </h3>
      <p className="continuity-muted">
        {review
          ? t('Reviewed by {name} on {date}', { name: review.reviewerName, date: formatTime(review.reviewedAt) }) + (review.note ? ` · ${review.note}` : '')
          : t('Patients see: “Not yet reviewed by your clinic.”')}
      </p>
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
        <button type="button" className="btn-primary" disabled={busy} onClick={() => void onChange(async () => { await markTopicReviewed(topic.id, note); setNote(''); }, t('Marked as reviewed.'))}>
          {review ? t('Mark as reviewed again') : t('Mark as reviewed')}
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
