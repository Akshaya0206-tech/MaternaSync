import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { searchDoctor } from '../../api/doctorSearch';
import type { DoctorSearchResult } from '../../api/doctorSearch';
import { useLanguage } from '../../i18n';
import { Highlight } from './SearchParts';
import { MIN_QUERY, cleanQuery, documentLabel, documentMeta, patientMeta, questionMeta, summaryText } from './searchText';

const SHOWN = 50;

/** Every result of one search, in the same three groups as the box at the top of the page lists. Opened with /doctor/search?q=<words>. */
export function SearchResultsPage() {
  const { t } = useLanguage();
  const [params] = useSearchParams();
  const query = cleanQuery(params.get('q') ?? '');
  const searchable = query.length >= MIN_QUERY;
  const [result, setResult] = useState<DoctorSearchResult | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'done'>('idle');

  useEffect(() => {
    if (!searchable) { setResult(null); setState('idle'); return; }
    let current = true;
    setState('loading');
    searchDoctor(query, SHOWN)
      .then((answer) => { if (current) { setResult(answer); setState('done'); } })
      .catch(() => { if (current) setState('error'); });
    return () => { current = false; };
  }, [query, searchable]);

  const empty = result !== null && !result.patients.total && !result.questions.total && !result.documents.total;
  const more = (total: number) => (total > SHOWN ? <p className="continuity-muted">{t('Showing the first {count}. Type more words to narrow the search.', { count: SHOWN })}</p> : null);

  return (
    <main className="continuity-page search-page">
      <h1 className="page-title">{t('Search results')}</h1>
      <p className="continuity-muted">
        {searchable ? t('Results for “{query}”', { query }) : t('Type at least 2 characters in the search box above.')}
      </p>
      <p role="status" className="search-status">
        {state === 'loading' ? t('Searching…') : state === 'error' ? t('Could not search. Please try again.') : state === 'done' && result ? summaryText(result, query, t) : ''}
      </p>

      {result && result.patients.total > 0 && (
        <section className="glass-panel continuity-panel" aria-labelledby="search-patients">
          <div className="continuity-panel-heading"><h2 id="search-patients">{t('Patients')} ({result.patients.total})</h2></div>
          <ul className="search-list">
            {result.patients.items.map((item) => (
              <li key={item.id}>
                <Link to={item.link} className="search-hit">
                  <span className="search-hit-label"><Highlight text={item.label} query={query} /></span>
                  {patientMeta(item, t) && <span className="search-hit-meta"><Highlight text={patientMeta(item, t)} query={query} /></span>}
                </Link>
              </li>
            ))}
          </ul>
          {more(result.patients.total)}
        </section>
      )}

      {result && result.questions.total > 0 && (
        <section className="glass-panel continuity-panel" aria-labelledby="search-questions">
          <div className="continuity-panel-heading"><h2 id="search-questions">{t('Questions')} ({result.questions.total})</h2></div>
          <ul className="search-list">
            {result.questions.items.map((item) => (
              <li key={item.id}>
                <Link to={item.link} className="search-hit">
                  <span className="search-hit-label"><Highlight text={item.label} query={query} /></span>
                  <span className="search-hit-meta"><Highlight text={questionMeta(item, t)} query={query} /></span>
                </Link>
              </li>
            ))}
          </ul>
          {more(result.questions.total)}
        </section>
      )}

      {result && result.documents.total > 0 && (
        <section className="glass-panel continuity-panel" aria-labelledby="search-documents">
          <div className="continuity-panel-heading"><h2 id="search-documents">{t('Documents')} ({result.documents.total})</h2></div>
          <ul className="search-list">
            {result.documents.items.map((item) => (
              <li key={item.id}>
                <Link to={item.link} className="search-hit">
                  <span className="search-hit-label"><Highlight text={documentLabel(item, t)} query={query} /></span>
                  <span className="search-hit-meta"><Highlight text={documentMeta(item, t)} query={query} /></span>
                </Link>
              </li>
            ))}
          </ul>
          {more(result.documents.total)}
        </section>
      )}

      {empty && <p className="continuity-empty">{t('Nothing matches “{query}”. Try part of a name, a record number or a word from the question.', { query })}</p>}
    </main>
  );
}
