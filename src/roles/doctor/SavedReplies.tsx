import { useId, useState } from 'react';
import { BookmarkPlus, Pencil, Trash2 } from 'lucide-react';
import { addReplySnippet, changeReplySnippet, deleteReplySnippet } from '../../api/doctorConsultQ';
import type { ReplySnippet } from '../../api/doctorConsultQ';
import { ApiError } from '../../api/client';
import { tx, useLanguage } from '../../i18n';

/** The doctor's own saved replies, shown beside the reply box. Picking one only puts her words into the box: she edits them, and nothing is sent until she
 *  approves the reply as usual. She sees only her own. */
export function SavedReplies({ snippets, onChanged, onInsert }: { snippets: ReplySnippet[]; onChanged: (next: ReplySnippet[]) => void; onInsert: (text: string) => void }) {
  const { t } = useLanguage();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const begin = (snippet: ReplySnippet | null) => {
    setEditing(snippet ? snippet.id : 'new');
    setTitle(snippet?.title ?? '');
    setText(snippet?.text ?? '');
    setError(null);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      if (editing === 'new') {
        const made = await addReplySnippet(title.trim(), text.trim());
        onChanged([...snippets, made].sort((a, b) => a.title.localeCompare(b.title)));
      } else if (editing) {
        const changed = await changeReplySnippet(editing, title.trim(), text.trim());
        onChanged(snippets.map((s) => (s.id === editing ? changed : s)).sort((a, b) => a.title.localeCompare(b.title)));
      }
      setEditing(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : tx('Could not save this reply.'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (snippet: ReplySnippet) => {
    if (!window.confirm(t('Delete the saved reply “{title}”?', { title: snippet.title }))) return;
    setError(null);
    try {
      await deleteReplySnippet(snippet.id);
      onChanged(snippets.filter((s) => s.id !== snippet.id));
    } catch {
      setError(tx('Could not delete this reply.'));
    }
  };

  const valid = title.trim().length >= 2 && text.trim().length >= 2;

  return (
    <div className="saved-replies">
      <button type="button" className="btn-secondary" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <BookmarkPlus size={14} aria-hidden="true" /> {t('Saved replies ({count})', { count: snippets.length })}
      </button>
      {open && (
        <div className="saved-replies-panel">
          <p className="continuity-muted">{t('Replies you wrote and saved. Only you can see them. Choosing one puts it in the box so you can change it: nothing is sent until you approve.')}</p>
          {error && <div role="alert" className="continuity-alert">{t(error)}</div>}
          {snippets.length === 0 && editing === null && <p className="continuity-muted">{t('You have not saved any replies yet.')}</p>}
          {snippets.map((snippet) => (
            <div key={snippet.id} className="saved-reply-row">
              <button type="button" className="saved-reply-use" onClick={() => onInsert(snippet.text)} title={snippet.text}>
                <strong>{snippet.title}</strong>
                <span>{snippet.text.length > 110 ? `${snippet.text.slice(0, 110)}…` : snippet.text}</span>
              </button>
              <button type="button" className="btn-secondary" aria-label={t('Edit the saved reply “{title}”', { title: snippet.title })} onClick={() => begin(snippet)}><Pencil size={13} aria-hidden="true" /></button>
              <button type="button" className="btn-secondary" aria-label={t('Delete the saved reply “{title}”', { title: snippet.title })} onClick={() => void remove(snippet)}><Trash2 size={13} aria-hidden="true" /></button>
            </div>
          ))}
          {editing === null ? (
            <button type="button" className="btn-secondary" onClick={() => begin(null)}>{t('Save a new reply')}</button>
          ) : (
            <div className="saved-reply-form">
              <div className="saved-reply-field">
                <label htmlFor={`${id}-title`}>{t('Title')}</label>
                <input id={`${id}-title`} value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="saved-reply-field">
                <label htmlFor={`${id}-text`}>{t('Reply')}</label>
                <textarea id={`${id}-text`} rows={3} value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} />
              </div>
              <div className="saved-reply-actions">
                <button type="button" className="btn-primary" disabled={busy || !valid} onClick={() => void save()}>{t('Save reply')}</button>
                <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>{t('Cancel')}</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
