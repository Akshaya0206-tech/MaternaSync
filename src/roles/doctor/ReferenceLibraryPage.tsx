import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  addReference, attachReferencePdf, changeReference, deleteReference, detachReferencePdf,
  openReferencePdf, saveReferenceNote, searchReferences,
} from '../../api/references';
import type { Passage, Reference, ReferenceInput, ReferenceSearch } from '../../api/references';
import { Badge, Empty, Feedback, Field, Page, Panel, useAction } from '../../components/continuity/shared';

const CATEGORIES: Record<string, string> = {
  ANTENATAL_CARE: 'Antenatal care',
  HIGH_RISK: 'High-risk pregnancy',
  LABOR_DELIVERY: 'Labour and delivery',
  POSTPARTUM: 'After the birth',
  SCREENING: 'Screening and tests',
  NUTRITION: 'Nutrition',
  MEDICATION_SAFETY: 'Medication safety',
  GENERAL: 'General',
};
const WHERE: Record<string, string> = {
  title: 'its title', tags: 'your search words', auto_core: 'a related term in its title or topic', topic: 'its topic', issuer: 'its publisher',
  notes: 'your notes', summary: 'its summary', auto_wide: 'a related term in its summary', pdf: 'a passage inside its PDF',
};
const EXAMPLES = ['sugar', 'BP in pregnancy', 'bleeding after delivery', 'anaemia', 'c section', 'twins'];
const blank: ReferenceInput = { title: '', issuer: '', topic: '', category: '', jurisdiction: '', publicationDate: '', sourceUrl: '', summary: '', notes: '', tags: [] };

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

export function ReferenceLibraryPage() {
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
      if (request === latest.current) setError(e instanceof Error ? e.message : 'The search did not work. Please try again.');
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
    <Page
      title="Reference Library"
      subtitle="Your own shelf of references to look things up in. What you add is visible to you only, and nothing here feeds any other page of the app."
    >
      <Feedback error={error || action.error} message={notice || action.message} />
      <form className="reflib-search" role="search" onSubmit={(e) => { e.preventDefault(); void load(); }}>
        <input
          type="search"
          aria-label="Search the Reference Library"
          placeholder="Search in plain words, for example: sugar, BP in pregnancy, bleeding after delivery"
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />
        <button className="btn-primary">Search</button>
        <button type="button" className="btn-secondary" onClick={() => setEditing('new')}>Add a reference</button>
      </form>
      <div className="reflib-examples" aria-label="Example searches">
        <span className="continuity-muted">Try:</span>
        {EXAMPLES.map((example) => (
          <button key={example} type="button" className="continuity-chip" onClick={() => setText(example)}>{example}</button>
        ))}
      </div>
      <div className="continuity-fields">
        <Field label="Topic area">
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All topic areas</option>
            {categories.map((c) => <option key={c} value={c}>{CATEGORIES[c] ?? c}</option>)}
          </select>
        </Field>
        <Field label="Publisher">
          <select value={issuer} onChange={(e) => setIssuer(e.target.value)}>
            <option value="">All publishers</option>
            {publishers.map((p) => <option key={p}>{p}</option>)}
          </select>
        </Field>
        <label className="continuity-check"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Only what I added</label>
        <label className="continuity-check"><input type="checkbox" checked={hasPdf} onChange={(e) => setHasPdf(e.target.checked)} /> Only references with a PDF I can search</label>
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
          {result.interpretation.corrections.map((c) => (
            <span key={c.from}>Showing results for <strong>{c.to}</strong> (you typed “{c.from}”). </span>
          ))}
          {result.interpretation.alsoSearched.length > 0 && <>Also looked for: {result.interpretation.alsoSearched.join(', ')}.</>}
        </p>
      )}

      {searching && (result?.passages.length ?? 0) > 0 && (
        <Panel title={`Passages from the PDFs (${result?.passages.length})`} aside={<Badge>Extracts, not summaries</Badge>}>
          <p className="continuity-muted">
            These are the parts of the saved PDFs that best match your words, shown exactly as written with their page. Nothing is
            rewritten or generated, so check the page before relying on it.
          </p>
          {result?.passages.map((p, index) => <PassageCard key={`${p.itemId}-${p.page}-${index}`} passage={p} onError={action.setError} />)}
        </Panel>
      )}

      <Panel title={loading ? 'Loading…' : `${result?.total ?? 0} ${searching ? 'matching ' : ''}reference${result?.total === 1 ? '' : 's'}`}>
        {!loading && !result?.items.length && (
          <Empty>
            {searching ? 'Nothing matched. Try fewer or simpler words, or a different spelling.' : 'No references yet. Use “Add a reference” to start your shelf.'}
          </Empty>
        )}
        {result?.items.map((item) => (
          <ReferenceCard key={item.id} item={item} searching={searching} edit={() => setEditing(item)} changed={refreshAll} announce={setNotice} />
        ))}
      </Panel>
    </Page>
  );
}

function PassageCard({ passage, onError }: { passage: Passage; onError: (message: string) => void }) {
  return (
    <article className="continuity-item reflib-passage">
      <h3>{passage.title}</h3>
      <p className="continuity-muted">
        {[passage.issuer, passage.page ? `page ${passage.page}` : null, passage.section].filter(Boolean).join(' · ')}
      </p>
      <p className="reflib-quote">“{highlight(passage.text, passage.marks)}”</p>
      <button
        className="btn-secondary"
        onClick={() => openReferencePdf(passage.itemId, passage.page).catch((e) => onError(e instanceof Error ? e.message : 'Could not open the PDF.'))}
      >
        Open the PDF{passage.page ? ` at page ${passage.page}` : ''}
      </button>
    </article>
  );
}

function ReferenceCard({ item, searching, edit, changed, announce }: { item: Reference; searching: boolean; edit: () => void; changed: () => Promise<void>; announce: (message: string) => void }) {
  const action = useAction();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(item.myNote);
  const meta = [item.issuer, item.jurisdiction, item.publicationDate, item.category ? CATEGORIES[item.category] ?? item.category : null].filter(Boolean);
  return (
    <article className="continuity-item">
      <h3>
        {item.title} {item.mine && <Badge>Added by you</Badge>} {item.hasPdf && <Badge>PDF kept · searchable</Badge>}
      </h3>
      <p className="continuity-muted">{meta.join(' · ')}</p>
      {searching && item.matchedOn && item.matchedOn.length > 0 && (
        <p className="continuity-muted">Found through {item.matchedOn.map((w) => WHERE[w] ?? w).join(' and ')}.</p>
      )}
      <p>{open ? item.summary : `${item.summary.slice(0, 260)}${item.summary.length > 260 ? '…' : ''}`}</p>
      <Feedback error={action.error} message={action.message} />
      <div className="continuity-actions">
        {item.sourceUrl && <a className="btn-secondary" href={item.sourceUrl} target="_blank" rel="noreferrer">Open the publisher’s page ↗</a>}
        {item.documentUrl && <a className="btn-secondary" href={item.documentUrl} target="_blank" rel="noreferrer">Open the document ↗</a>}
        {item.hasPdf && (
          <button className="btn-secondary" onClick={() => void action.run(() => openReferencePdf(item.id), '')}>Open my PDF copy</button>
        )}
        <button className="btn-secondary" aria-expanded={open} onClick={() => setOpen((v) => !v)}>{open ? 'Show less' : 'More about this'}</button>
      </div>
      {open && (
        <div className="reflib-more">
          {item.editionNote && <p><strong>About this edition:</strong> {item.editionNote}</p>}
          {item.rightsNote && <p className="continuity-muted"><strong>Copyright and reuse:</strong> {item.rightsNote}</p>}
          {item.notes && <p><strong>Your notes:</strong> {item.notes}</p>}
          {item.tags.length > 0 && <p className="continuity-muted"><strong>Your search words:</strong> {item.tags.join(', ')}</p>}
          {item.searchTerms.length > 0 && (
            <p className="continuity-muted"><strong>Also found by:</strong> {item.searchTerms.join(', ')}</p>
          )}
          <Field label="My private note on this reference">
            <textarea rows={3} maxLength={20000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Only you can see this. It is searchable." />
          </Field>
          <div className="continuity-actions">
            <button
              className="btn-secondary"
              disabled={action.busy || note === item.myNote}
              onClick={() => void action.run(async () => { await saveReferenceNote(item.id, note); await changed(); }, 'Note saved.')}
            >
              Save my note
            </button>
            {item.mine && <button className="btn-secondary" onClick={edit}>Edit this reference</button>}
            {item.mine && !item.hasPdf && (
              <label className="btn-secondary reflib-file">
                Keep a PDF copy
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
                        if (!updated.passages) throw new Error('The PDF was saved, but no text could be read from it (it may be a scan), so it cannot be searched.');
                        await changed();
                      }, 'PDF saved. Its pages are now searchable.');
                    }
                  }}
                />
              </label>
            )}
            {item.mine && item.hasPdf && (
              <button className="btn-secondary" disabled={action.busy} onClick={() => void action.run(async () => { await detachReferencePdf(item.id); await changed(); }, 'PDF removed.')}>
                Remove my PDF copy
              </button>
            )}
            {item.mine && (
              <button
                className="btn-secondary"
                disabled={action.busy}
                onClick={() => {
                  if (window.confirm(`Delete “${item.title}” from your shelf? This cannot be undone.`))
                    void action.run(async () => { await deleteReference(item.id); announce(`Deleted “${item.title}”.`); await changed(); }, '');
                }}
              >
                Delete
              </button>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

function ReferenceForm({ initial, close, saved }: { initial: Reference | null; close: () => void; saved: () => Promise<void> }) {
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
    <Panel title={initial ? 'Edit this reference' : 'Add a reference'} aside={<button className="btn-secondary" onClick={close}>Close</button>}>
      <Feedback error={action.error} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void action.run(async () => {
            const body = { ...form, tags: tagText.split(',').map((t) => t.trim()).filter(Boolean) };
            if (initial) await changeReference(initial.id, body);
            else await addReference(body);
            await saved();
          }, 'Saved.');
        }}
      >
        <div className="continuity-fields">
          <Field label="Title"><input required minLength={3} maxLength={300} value={form.title} onChange={(e) => set('title', e.target.value)} /></Field>
          <Field label="Publisher or source"><input maxLength={200} value={form.issuer} onChange={(e) => set('issuer', e.target.value)} placeholder="For example WHO, my hospital" /></Field>
          <Field label="Topic"><input maxLength={120} value={form.topic} onChange={(e) => set('topic', e.target.value)} placeholder="For example Gestational diabetes" /></Field>
          <Field label="Topic area">
            <select value={form.category} onChange={(e) => set('category', e.target.value)}>
              <option value="">Not set</option>
              {Object.entries(CATEGORIES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </Field>
          <Field label="Country or region"><input maxLength={120} value={form.jurisdiction} onChange={(e) => set('jurisdiction', e.target.value)} /></Field>
          <Field label="Year"><input maxLength={10} pattern="\d{4}(-\d{2}(-\d{2})?)?" title="A year such as 2024, or 2024-06" value={form.publicationDate} onChange={(e) => set('publicationDate', e.target.value)} /></Field>
          <Field label="Web link"><input type="url" maxLength={1000} value={form.sourceUrl} onChange={(e) => set('sourceUrl', e.target.value)} placeholder="https://" /></Field>
          <Field label="Search words (separate with commas)"><input value={tagText} onChange={(e) => setTagText(e.target.value)} placeholder="Words you would type to find it" /></Field>
        </div>
        <Field label="What it covers"><textarea rows={3} maxLength={20000} value={form.summary} onChange={(e) => set('summary', e.target.value)} /></Field>
        <Field label="My notes"><textarea rows={3} maxLength={20000} value={form.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
        <div className="continuity-actions">
          <button className="btn-primary" disabled={action.busy}>{initial ? 'Save changes' : 'Add to my shelf'}</button>
        </div>
        <p className="continuity-muted">You can keep a PDF copy after saving, so its pages can be searched too.</p>
      </form>
    </Panel>
  );
}
