import { useRef } from 'react';
import { useLanguage } from '../../i18n';
import { Field } from '../../components/continuity/shared';
import { SYMPTOMS, isPicked, toggled } from './symptoms';

/** The tap-to-add symptom buttons with an "Other" button that opens a space to type. The tapped buttons and the typed
 *  text are kept apart here and joined into one plain line when the check-in is saved. */
export function SymptomPicker({
  symptoms, other, otherOpen, onSymptoms, onOther, onOtherOpen,
}: {
  symptoms: string;
  other: string;
  otherOpen: boolean;
  onSymptoms: (next: string) => void;
  onOther: (next: string) => void;
  onOtherOpen: (open: boolean) => void;
}) {
  const { t, language } = useLanguage();
  const box = useRef<HTMLTextAreaElement>(null);
  return (
    <div role="group" aria-label={t('Common symptoms')}>
      <p className="continuity-muted" style={{ marginBottom: 0 }}>
        <strong>{t('Common symptoms')}</strong> · {t('Tap any that apply today. Choose Other to type something else.')}
      </p>
      <div className="continuity-chip-row">
        {SYMPTOMS.map((label) => (
          <button
            key={label}
            type="button"
            className="continuity-chip"
            aria-pressed={isPicked(symptoms, label, language, t)}
            onClick={() => onSymptoms(toggled(symptoms, label, language, t))}
          >
            {t(label)}
          </button>
        ))}
        <button
          type="button"
          className="continuity-chip"
          aria-pressed={otherOpen || Boolean(other)}
          onClick={() => {
            // With text already typed the box stays open, so a stray tap never throws it away.
            if (other.trim()) box.current?.focus();
            else onOtherOpen(!otherOpen);
          }}
        >
          {t('Other')}
        </button>
      </div>
      {(otherOpen || Boolean(other)) && (
        <Field label={t('Other symptoms or anything you want your team to know')}>
          <textarea
            ref={box}
            autoFocus={!other}
            rows={3}
            maxLength={4000}
            placeholder={t('Type here, for example how it feels and since when')}
            value={other}
            onChange={(e) => onOther(e.target.value)}
          />
        </Field>
      )}
      <p className="continuity-muted" style={{ marginBottom: 14 }}>
        {t('These are for everyday symptoms. If something is severe or sudden, contact your maternity team now instead of waiting to fill in a check-in.')}
      </p>
    </div>
  );
}
