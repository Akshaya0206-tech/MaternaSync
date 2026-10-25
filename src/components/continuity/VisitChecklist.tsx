import { useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import type { PrepItem } from '../../api/caregiver';
import { useAuth } from '../../auth/AuthContext';
import { useLanguage } from '../../i18n';
import { Feedback, useAction } from './shared';

/** "Getting ready for this visit": the lines a doctor wrote for one upcoming visit, which she or her trusted person can tick.
 *  The doctor sees what is ticked and by whom. It is a to-do list the doctor wrote, and nothing here is added by the app. */
export function VisitChecklist({ items, perspective, onTick }: { items: PrepItem[]; perspective: 'woman' | 'helper'; onTick: (item: PrepItem, done: boolean) => Promise<void> }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const action = useAction();
  // A tick shows at once and the save follows; if the save fails the saved state comes back.
  const [shown, setShown] = useState<Record<string, boolean>>({});
  if (!items.length) return null;
  const finished = items.filter((item) => item.done).length;
  const change = (item: PrepItem, done: boolean) => {
    setShown((old) => ({ ...old, [item.id]: done }));
    void action.run(async () => {
      await onTick(item, done);
    }, t('Saved.')).finally(() => setShown((old) => {
      const next = { ...old };
      delete next[item.id];
      return next;
    }));
  };
  return (
    <fieldset className="visit-prep">
      <legend><ClipboardCheck size={15} aria-hidden="true" /> {t('Getting ready for this visit')}</legend>
      <p className="continuity-muted">
        {perspective === 'woman' ? t('Your doctor wrote this list. Tick each line when it is done.') : t('Her doctor wrote this list. Tick a line when it is done.')}
        {' '}<span>{t('{done} of {total} done', { done: finished, total: items.length })}</span>
      </p>
      <Feedback error={action.error} />
      <ul className="visit-prep-list">
        {items.map((item) => (
          <li key={item.id}>
            <label className="visit-prep-line">
              <input type="checkbox" checked={shown[item.id] ?? item.done} disabled={action.busy} onChange={(e) => change(item, e.target.checked)} />
              <span>{item.text}</span>
            </label>
            {item.done && item.doneByName && (
              <small className="continuity-muted">{item.doneByName === user?.fullName ? t('Ticked by you') : t('Ticked by {name}', { name: item.doneByName })}</small>
            )}
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
