import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { FileText, MessageCircle, Search, User, X } from 'lucide-react';
import { searchDoctor } from '../../api/doctorSearch';
import type { DoctorSearchResult } from '../../api/doctorSearch';
import { useLanguage } from '../../i18n';
import { Highlight } from './SearchParts';
import { MAX_QUERY, MIN_QUERY, cleanQuery, documentLabel, documentMeta, patientMeta, questionMeta, summaryText } from './searchText';

interface Option {
  id: string;
  link: string;
  group: 'patients' | 'questions' | 'documents';
  kind: 'result' | 'all';
  label: string;
  meta: string;
}

const DEBOUNCE_MS = 250;
const GROUPS = ['patients', 'questions', 'documents'] as const;

/** The one search box at the top of every doctor page: patients, her questions and the documents of her patients. It is a combobox: the
 *  arrow keys move through the results, Enter opens one, Escape closes the list, and "/" jumps to the box from anywhere on the page. */
export function GlobalSearch() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const base = useId();
  const inputId = `${base}-input`;
  const listId = `${base}-list`;
  const optionId = (index: number) => `${base}-option-${index}`;
  const input = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const latest = useRef(0);
  // On the full results page the box starts with what the page was opened for.
  const [query, setQuery] = useState(() => (pathname === '/doctor/search' ? params.get('q') ?? '' : ''));
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<DoctorSearchResult | null>(null);
  const [asked, setAsked] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(-1);

  const typed = cleanQuery(query);
  const searchable = typed.length >= MIN_QUERY;

  // Look up what was typed, a moment after the typing stops. An answer that arrives after something newer was typed is ignored.
  useEffect(() => {
    if (!searchable) {
      latest.current += 1;
      setResult(null);
      setBusy(false);
      setFailed(false);
      return;
    }
    const ticket = ++latest.current;
    setBusy(true);
    const timer = window.setTimeout(() => {
      searchDoctor(typed, 5)
        .then((answer) => { if (ticket === latest.current) { setResult(answer); setAsked(typed); setFailed(false); setActive(-1); } })
        .catch(() => { if (ticket === latest.current) { setResult(null); setFailed(true); } })
        .finally(() => { if (ticket === latest.current) setBusy(false); });
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [typed, searchable]);

  // "/" jumps to the box, unless the doctor is typing somewhere.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      event.preventDefault();
      input.current?.focus();
      input.current?.select();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const showAll = `/doctor/search?q=${encodeURIComponent(typed)}`;
  const options = useMemo<Option[]>(() => {
    if (!result) return [];
    const list: Option[] = [];
    result.patients.items.forEach((item) => list.push({ id: item.id, link: item.link, group: 'patients', kind: 'result', label: item.label, meta: patientMeta(item, t) }));
    if (result.patients.total > result.patients.items.length) list.push({ id: 'all-patients', link: showAll, group: 'patients', kind: 'all', label: t('Show all {count} patients', { count: result.patients.total }), meta: '' });
    result.questions.items.forEach((item) => list.push({ id: item.id, link: item.link, group: 'questions', kind: 'result', label: item.label, meta: questionMeta(item, t) }));
    if (result.questions.total > result.questions.items.length) list.push({ id: 'all-questions', link: showAll, group: 'questions', kind: 'all', label: t('Show all {count} questions', { count: result.questions.total }), meta: '' });
    result.documents.items.forEach((item) => list.push({ id: item.id, link: item.link, group: 'documents', kind: 'result', label: documentLabel(item, t), meta: documentMeta(item, t) }));
    if (result.documents.total > result.documents.items.length) list.push({ id: 'all-documents', link: showAll, group: 'documents', kind: 'all', label: t('Show all {count} documents', { count: result.documents.total }), meta: '' });
    return list;
  }, [result, showAll, t]);

  useEffect(() => { if (active >= 0) document.getElementById(`${base}-option-${active}`)?.scrollIntoView({ block: 'nearest' }); }, [active, base]);

  const close = () => { setOpen(false); setActive(-1); };
  const clear = () => { setQuery(''); setResult(null); close(); input.current?.focus(); };
  // Opening one result clears the box; opening the page of all results keeps the words, because that page is about them.
  const go = (link: string, keepText = false) => {
    close();
    if (!keepText) { setQuery(''); setResult(null); }
    input.current?.blur();
    navigate(link);
  };

  // On the results page the box follows the address (back and forward, or a link to a search).
  const wanted = pathname === '/doctor/search' ? params.get('q') ?? '' : null;
  useEffect(() => { if (wanted !== null) setQuery(wanted); }, [wanted]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!options.length) return;
      event.preventDefault();
      setOpen(true);
      setActive((current) => (event.key === 'ArrowDown' ? (current + 1) % options.length : (current - 1 + options.length) % options.length));
    } else if (event.key === 'Home' && open && options.length) {
      event.preventDefault();
      setActive(0);
    } else if (event.key === 'End' && open && options.length) {
      event.preventDefault();
      setActive(options.length - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (open && active >= 0 && options[active]) go(options[active].link, options[active].kind === 'all');
      else if (searchable) go(showAll, true);
    } else if (event.key === 'Escape') {
      if (open) { event.preventDefault(); close(); } else if (query) { event.preventDefault(); clear(); }
    }
  };

  const hasList = open && searchable && Boolean(result) && options.length > 0 && !failed;
  const message = !open || !query ? '' : !searchable ? t('Type at least 2 characters') : failed ? t('Could not search. Please try again.') : busy && !result ? t('Searching…') : result && options.length === 0 && !busy ? t('No results for “{query}”', { query: asked }) : '';
  const announcement = result && searchable && !busy && !failed ? summaryText(result, asked, t) : '';
  const icon = { patients: <User size={15} aria-hidden="true" />, questions: <MessageCircle size={15} aria-hidden="true" />, documents: <FileText size={15} aria-hidden="true" /> };
  const titles = { patients: t('Patients'), questions: t('Questions'), documents: t('Documents') };

  return (
    <div className="gs-root" ref={root} role="search" onBlur={(event) => { if (!root.current?.contains(event.relatedTarget as Node | null)) close(); }}>
      <label htmlFor={inputId} className="gs-label">{t('Search patients, questions and documents')}</label>
      <div className="gs-field">
        <Search size={16} aria-hidden="true" />
        <input
          id={inputId}
          ref={input}
          type="text"
          role="combobox"
          aria-expanded={hasList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={hasList && active >= 0 ? optionId(active) : undefined}
          autoComplete="off"
          spellCheck={false}
          maxLength={MAX_QUERY}
          enterKeyHint="search"
          placeholder={t('Name, record number, phone, question or document')}
          value={query}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); setActive(-1); }}
          onFocus={() => { if (query) setOpen(true); }}
          onKeyDown={onKeyDown}
        />
        {query && (
          <button type="button" className="gs-clear" aria-label={t('Clear search')} onClick={clear}>
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </div>
      <p className="gs-sr" role="status" aria-live="polite">{announcement}</p>
      {(hasList || message) && (
        <div className="gs-popup" tabIndex={0} onMouseDown={(event) => { if ((event.target as HTMLElement).closest('.gs-option')) event.preventDefault(); }}>
          {message && <p className="gs-message">{message}</p>}
          {hasList && (
            <div role="listbox" id={listId} aria-label={t('Search results')}>
              {GROUPS.map((group) => {
                const rows = options.map((option, index) => ({ option, index })).filter(({ option }) => option.group === group);
                if (!rows.length) return null;
                const total = result?.[group].total ?? 0;
                return (
                  <div key={group} role="group" aria-labelledby={`${base}-title-${group}`} className="gs-group">
                    <div id={`${base}-title-${group}`} className="gs-group-title">{icon[group]} {titles[group]} <span className="gs-count">({total})</span></div>
                    {rows.map(({ option, index }) => (
                      <div
                        key={`${option.kind}-${option.id}`}
                        id={optionId(index)}
                        role="option"
                        aria-selected={active === index}
                        className={`gs-option${option.kind === 'all' ? ' gs-option-all' : ''}`}
                        onMouseEnter={() => setActive(index)}
                        onClick={() => go(option.link, option.kind === 'all')}
                      >
                        <span className="gs-option-label">{option.kind === 'result' ? <Highlight text={option.label} query={asked} /> : option.label}</span>
                        {option.meta && <span className="gs-option-meta">{option.kind === 'result' ? <Highlight text={option.meta} query={asked} /> : option.meta}</span>}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
