import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  addReference, attachReferencePdf, changeReference, deleteReference, detachReferencePdf,
  openReferencePdf, saveReferenceNote, searchReferences,
} from '../../api/references';
import type { Passage, Reference, ReferenceInput, ReferenceSearch } from '../../api/references';
import { Badge, Empty, Feedback, Field, Panel, useAction } from '../../components/continuity/shared';
import { tx, useLanguage } from '../../i18n';
import type { LanguageValue } from '../../i18n';

const CATEGORIES: Record<string, string> = {
  ANTENATAL_CARE: tx('Antenatal care'),
  HIGH_RISK: tx('High-risk pregnancy'),
  LABOR_DELIVERY: tx('Labour and delivery'),
  POSTPARTUM: tx('After the birth'),
  SCREENING: tx('Screening and tests'),
  NUTRITION: tx('Nutrition'),
  MEDICATION_SAFETY: tx('Medication safety'),
  GENERAL: tx('General'),
};
const WHERE: Record<string, string> = {
  title: tx('its title'), tags: tx('your search words'), auto_core: tx('a related term in its title or topic'), topic: tx('its topic'), issuer: tx('its publisher'),
  notes: tx('your notes'), summary: tx('its summary'), auto_wide: tx('a related term in its summary'), pdf: tx('a passage inside its PDF'), meaning: tx('its meaning'),
};
const EXAMPLES = ['sugar', 'BP in pregnancy', 'bleeding after delivery', 'anaemia', 'c section', 'twins'];
const blank: ReferenceInput = { title: '', issuer: '', topic: '', category: '', jurisdiction: '', publicationDate: '', sourceUrl: '', summary: '', notes: '', tags: [] };

// Stands in for a value that is shown in bold while the rest of its sentence is translated around it.
const BOLD_MARK = '\u0001';

function referenceCount(total: number, searching: boolean, t: LanguageValue['t']): string {
  if (searching) return total === 1 ? t('{count} matching reference', { count: total }) : t('{count} matching references', { count: total });
  return total === 1 ? t('{count} reference', { count: total }) : t('{count} references', { count: total });
}

function highlight(text: string, marks: string[]): ReactNode {
  if (!marks.length) return text;
  const pattern = new RegExp(`\\b(${marks.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'gi');
  return text.split(pattern).map((part, index) => (index % 2 ? <mark key={index}>{part}</mark> : part));
}

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// The first tab of the References page (ReferencesPage.tsx), which supplies the heading.
export function ReferenceLibraryView() {
  const { t } = useLanguage();
  const action = useAction();
  const [catalog, setCatalog] = useState<Reference[]>([]);
  const [text, setText] = useState('');
  const [category, setCategory] = useState('');
  const [issuer, setIssuer] = useState('');
  const [mine, setMine] = useState(false);
  const [hasPdf, setHasPdf] = useState(false);
  const [result, setResult] = useState<ReferenceSearch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Reference | 'new' | null>(null);
  const [notice, setNotice] = useState(''); // for messages about a card that is no longer on the page
  const query = useDebounced(text.trim());
  const latest = useRef(0);
  // `load` is also called after a save, from a function made when the form was opened. It must search for what is
  // typed now, not for what was typed then, or a slow save would bring back the old results.
  const filters = useRef({ query, category, issuer, mine, hasPdf });
  useEffect(() => {
    filters.current = { query, category, issuer, mine, hasPdf };
  }, [query, category, issuer, mine, hasPdf]);

  const load = async () => {
    const request = ++latest.current;
    try {
      const current = filters.current;
      const found = await searchReferences({ q: current.query, category: current.category, issuer: current.issuer, mine: current.mine, hasPdf: current.hasPdf });
      if (request === latest.current) {
        setResult(found);
        setError('');
      }
    } catch (e) {
      if (request === latest.current) setError(e instanceof Error ? e.message : tx('The search did not work. Please try again.'));
    } finally {
      if (request === latest.current) setLoading(false);
    }
  };
  useEffect(() => {
    void load();
    // load reads the current filters; it is re-run whenever one of them changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, category, issuer, mine, hasPdf]);
  useEffect(() => {
    searchReferences({}).then((r) => setCatalog(r.items)).catch(() => { /* the filters just stay short */ });
  }, []);

  const publishers = [...new Set(catalog.map((r) => r.issuer).filter(Boolean))].sort() as string[];
  const categories = [...new Set(catalog.map((r) => r.category).filter(Boolean))].sort() as string[];
  const searching = Boolean(query);
  const refreshAll = async () => {
    await load();
    setCatalog((await searchReferences({})).items);
  };

  return (
    <>
      <p className="continuity-muted" style={{ margin: '0 0 14px 0' }}>
        {t('Your own shelf of references to look things up in. What you add is visible to you only, and nothing here feeds any other page of the app.')}
      </p>
      <Feedback error={t(error) || action.error} message={notice || action.message} />
      <form className="reflib-search" role="search" onSubmit={(e) => { e.preventDefault(); void load(); }}>
        <input
          type="search"
          aria-label={t('Search the Reference Library')}
          placeholder={t('Search in plain words, for example: sugar, BP in pregnancy, bleeding after delivery')}
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />
        <button className="btn-primary">{t('Search')}</button>
        <button type="button" className="btn-secondary" onClick={() => setEditing('new')}>{t('Add a reference')}</button>
      </form>
      <div className="reflib-examples" aria-label={t('Example searches')}>
        <span className="continuity-muted">{t('Try:')}</span>
        {EXAMPLES.map((example) => (
          <button key={example} type="button" className="continuity-chip" onClick={() => setText(example)}>{example}</button>
        ))}
      </div>
      {result?.semantic && (
        <p className="continuity-muted">
          {t('You can also type in Hindi, Tamil or Telugu. The search then matches by meaning and finds the English passage; the extract stays exactly as the document wrote it.')}
        </p>
      )}
      <div className="continuity-fields">
        <Field label={t('Topic area')}>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">{t('All topic areas')}</option>
            {categories.map((c) => <option key={c} value={c}>{t(CATEGORIES[c] ?? c)}</option>)}
          </select>
        </Field>
        <Field label={t('Publisher')}>
          <select value={issuer} onChange={(e) => setIssuer(e.target.value)}>
            <option value="">{t('All publishers')}</option>
            {publishers.map((p) => <option key={p}>{p}</option>)}
          </select>
        </Field>
        <label className="continuity-check"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> {t('Only what I added')}</label>
        <label className="continuity-check"><input type="checkbox" checked={hasPdf} onChange={(e) => setHasPdf(e.target.checked)} /> {t('Only references with a PDF I can search')}</label>
      </div>

      {editing && (
        <ReferenceForm
          key={editing === 'new' ? 'new' : editing.id}
          initial={editing === 'new' ? null : editing}
          close={() => setEditing(null)}
          saved={async () => { setEditing(null); await refreshAll(); }}
        />
      )}

      {result?.interpretation && (result.interpretation.corrections.length > 0 || result.interpretation.alsoSearched.length > 0) && (
        <p className="continuity-muted" role="status">
          {result.interpretation.corrections.map((c) => {
            // The corrected word is shown in bold wherever the sentence puts it in this language.
            const [before, after] = t('Showing results for {corrected} (you typed “{typed}”).', { corrected: BOLD_MARK, typed: c.from }).split(BOLD_MARK);
            return <span key={c.from}>{before}<strong>{c.to}</strong>{after} </span>;
          })}
          {result.interpretation.alsoSearched.length > 0 && <>{t('Also looked for: {terms}.', { terms: result.interpretation.alsoSearched.join(', ') })}</>}
        </p>
      )}

      {searching && (result?.passages.length ?? 0) > 0 && (
        <Panel title={t('Passages from the PDFs ({count})', { count: result?.passages.length ?? 0 })} aside={<Badge>{t('Extracts, not summaries')}</Badge>}>
          <p className="continuity-muted">
            {t('These are the parts of the saved PDFs that best match your words, shown exactly as written with their page. Nothing is rewritten or generated, so check the page before relying on it.')}
          </p>
          {result?.passages.map((p, index) => <PassageCard key={`${p.itemId}-${p.page}-${index}`} passage={p} onError={action.setError} />)}
        </Panel>
      )}

      <Panel title={loading ? t('Loading…') : referenceCount(result?.total ?? 0, searching, t)}>
        {!loading && !result?.items.length && (
          <Empty>
            {searching ? t('Nothing matched. Try fewer or simpler words, or a different spelling.') : t('No references yet. Use “Add a reference” to start your shelf.')}
          </Empty>
        )}
        {result?.items.map((item) => (
          <ReferenceCard key={item.id} item={item} searching={searching} edit={() => setEditing(item)} changed={refreshAll} announce={setNotice} />
        ))}
      </Panel>
    </>
  );
}

function PassageCard({ passage, onError }: { passage: Passage; onError: (message: string) => void }) {
  const { t } = useLanguage();
  return (
    <article className="continuity-item reflib-passage">
      <h3>{passage.title}</h3>
      <p className="continuity-muted">
        {[passage.issuer, passage.page ? t('page {page}', { page: passage.page }) : null, passage.section].filter(Boolean).join(' · ')}
        {passage.matchedBy === 'meaning' && <> <Badge>{t('Found by meaning')}</Badge></>}
      </p>
      <p className="reflib-quote">“{highlight(passage.text, passage.marks)}”</p>
      <button
        className="btn-secondary"
        onClick={() => openReferencePdf(passage.itemId, passage.page).catch((e) => onError(e instanceof Error ? e.message : t('Could not open the PDF.')))}
      >
        {passage.page ? t('Open the PDF at page {page}', { page: passage.page }) : t('Open the PDF')}
      </button>
    </article>
  );
}

function ReferenceCard({ item, searching, edit, changed, announce }: { item: Reference; searching: boolean; edit: () => void; changed: () => Promise<void>; announce: (message: string) => void }) {
  const { t } = useLanguage();
  const action = useAction();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(item.myNote);
  const meta = [item.issuer, item.jurisdiction, item.publicationDate, item.category ? t(CATEGORIES[item.category] ?? item.category) : null].filter(Boolean);
  return (
    <article className="continuity-item">
      <h3>
        {item.title} {item.mine && <Badge>{t('Added by you')}</Badge>} {item.hasPdf && <Badge>{t('PDF kept · searchable')}</Badge>}
      </h3>
      <p className="continuity-muted">{meta.join(' · ')}</p>
      {searching && item.matchedOn && item.matchedOn.length > 0 && (
        <p className="continuity-muted">{t('Found through {where}.', { where: item.matchedOn.map((w) => t(WHERE[w] ?? w)).join(` ${t('and')} `) })}</p>
      )}
      <p>{open ? item.summary : `${item.summary.slice(0, 260)}${item.summary.length > 260 ? '…' : ''}`}</p>
      <Feedback error={action.error} message={action.message} />
      <div className="continuity-actions">
        {item.sourceUrl && <a className="btn-secondary" href={item.sourceUrl} target="_blank" rel="noreferrer">{t('Open the publisher’s page ↗')}</a>}
        {item.documentUrl && <a className="btn-secondary" href={item.documentUrl} target="_blank" rel="noreferrer">{t('Open the document ↗')}</a>}
        {item.hasPdf && (
          <button className="btn-secondary" onClick={() => void action.run(() => openReferencePdf(item.id), '')}>{t('Open my PDF copy')}</button>
        )}
        <button className="btn-secondary" aria-expanded={open} onClick={() => setOpen((v) => !v)}>{open ? t('Show less') : t('More about this')}</button>
      </div>
      {open && (
        <div className="reflib-more">
          {item.editionNote && <p><strong>{t('About this edition:')}</strong> {item.editionNote}</p>}
          {item.rightsNote && <p className="continuity-muted"><strong>{t('Copyright and reuse:')}</strong> {item.rightsNote}</p>}
          {item.notes && <p><strong>{t('Your notes:')}</strong> {item.notes}</p>}
          {item.tags.length > 0 && <p className="continuity-muted"><strong>{t('Your search words:')}</strong> {item.tags.join(', ')}</p>}
          {item.searchTerms.length > 0 && (
            <p className="continuity-muted"><strong>{t('Also found by:')}</strong> {item.searchTerms.join(', ')}</p>
          )}
          <Field label={t('My private note on this reference')}>
            <textarea rows={3} maxLength={20000} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('Only you can see this. It is searchable.')} />
          </Field>
          <div className="continuity-actions">
            <button
              className="btn-secondary"
              disabled={action.busy || note === item.myNote}
              onClick={() => void action.run(async () => { await saveReferenceNote(item.id, note); await changed(); }, t('Note saved.'))}
            >
              {t('Save my note')}
            </button>
            {item.mine && <button className="btn-secondary" onClick={edit}>{t('Edit this reference')}</button>}
            {item.mine && !item.hasPdf && (
              <label className="btn-secondary reflib-file">
                {t('Keep a PDF copy')}
                <input
                  type="file"
                  accept="application/pdf"
                  disabled={action.busy}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) {
                      void action.run(async () => {
                        const updated = await attachReferencePdf(item.id, file);
                        if (!updated.passages) throw new Error(t('The PDF was saved, but no text could be read from it (it may be a scan), so it cannot be searched.'));
                        await changed();
                      }, t('PDF saved. Its pages are now searchable.'));
                    }
                  }}
                />
              </label>
            )}
            {item.mine && item.hasPdf && (
              <button className="btn-secondary" disabled={action.busy} onClick={() => void action.run(async () => { await detachReferencePdf(item.id); await changed(); }, t('PDF removed.'))}>
                {t('Remove my PDF copy')}
              </button>
            )}
            {item.mine && (
              <button
                className="btn-secondary"
                disabled={action.busy}
                onClick={() => {
                  if (window.confirm(t('Delete “{title}” from your shelf? This cannot be undone.', { title: item.title })))
                    void action.run(async () => { await deleteReference(item.id); announce(t('Deleted “{title}”.', { title: item.title })); await changed(); }, '');
                }}
              >
                {t('Delete')}
              </button>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

function ReferenceForm({ initial, close, saved }: { initial: Reference | null; close: () => void; saved: () => Promise<void> }) {
  const { t } = useLanguage();
  const action = useAction();
  const [form, setForm] = useState<ReferenceInput>(
    initial
      ? {
          title: initial.title, issuer: initial.issuer ?? '', topic: initial.topic ?? '', category: initial.category ?? '',
          jurisdiction: initial.jurisdiction ?? '', publicationDate: initial.publicationDate ?? '', sourceUrl: initial.sourceUrl ?? '',
          summary: initial.summary, notes: initial.notes, tags: initial.tags,
        }
      : blank,
  );
  const [tagText, setTagText] = useState(form.tags.join(', '));
  const set = (key: keyof ReferenceInput, value: string) => setForm((old) => ({ ...old, [key]: value }));
  return (
    <Panel title={initial ? t('Edit this reference') : t('Add a reference')} aside={<button className="btn-secondary" onClick={close}>{t('Close')}</button>}>
      <Feedback error={action.error} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void action.run(async () => {
            const body = { ...form, tags: tagText.split(',').map((tag) => tag.trim()).filter(Boolean) };
            if (initial) await changeReference(initial.id, body);
            else await addReference(body);
            await saved();
          }, t('Saved.'));
        }}
      >
        <div className="continuity-fields">
          <Field label={t('Title')}><input required minLength={3} maxLength={300} value={form.title} onChange={(e) => set('title', e.target.value)} /></Field>
          <Field label={t('Publisher or source')}><input maxLength={200} value={form.issuer} onChange={(e) => set('issuer', e.target.value)} placeholder={t('For example WHO, my hospital')} /></Field>
          <Field label={t('Topic')}><input maxLength={120} value={form.topic} onChange={(e) => set('topic', e.target.value)} placeholder={t('For example Gestational diabetes')} /></Field>
          <Field label={t('Topic area')}>
            <select value={form.category} onChange={(e) => set('category', e.target.value)}>
              <option value="">{t('Not set')}</option>
              {Object.entries(CATEGORIES).map(([key, label]) => <option key={key} value={key}>{t(label)}</option>)}
            </select>
          </Field>
          <Field label={t('Country or region')}><input maxLength={120} value={form.jurisdiction} onChange={(e) => set('jurisdiction', e.target.value)} /></Field>
          <Field label={t('Year')}><input maxLength={10} pattern="\d{4}(-\d{2}(-\d{2})?)?" title={t('A year such as 2024, or 2024-06')} value={form.publicationDate} onChange={(e) => set('publicationDate', e.target.value)} /></Field>
          <Field label={t('Web link')}><input type="url" maxLength={1000} value={form.sourceUrl} onChange={(e) => set('sourceUrl', e.target.value)} placeholder="https://" /></Field>
          <Field label={t('Search words (separate with commas)')}><input value={tagText} onChange={(e) => setTagText(e.target.value)} placeholder={t('Words you would type to find it')} /></Field>
        </div>
        <Field label={t('What it covers')}><textarea rows={3} maxLength={20000} value={form.summary} onChange={(e) => set('summary', e.target.value)} /></Field>
        <Field label={t('My notes')}><textarea rows={3} maxLength={20000} value={form.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
        <div className="continuity-actions">
          <button className="btn-primary" disabled={action.busy}>{initial ? t('Save changes') : t('Add to my shelf')}</button>
        </div>
        <p className="continuity-muted">{t('You can keep a PDF copy after saving, so its pages can be searched too.')}</p>
      </form>
    </Panel>
  );
}
