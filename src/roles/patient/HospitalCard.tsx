import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';
import type { EmergencyOverview } from '../../api/emergency';
import { tx, useLanguage } from '../../i18n';

const dial = (number: string) => `tel:${number.replace(/[^\d+]/g, '')}`;

/** "Show this to the hospital": one large, high-contrast card with only what she or her record already holds, so someone who is
 *  frightened, or who does not share her language, can hand over the phone or a printout. It never holds a health value, a result or
 *  a diagnosis. It is drawn from the last page the phone received, so it works with no signal. */
export function HospitalCard({ overview, onClose }: { overview: EmergencyOverview; onClose: () => void }) {
  const { t, language } = useLanguage();
  const [english, setEnglish] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(document.activeElement);

  // Say it in her language, or in English for the people at the hospital.
  const say = (text: string) => (english ? text : t(text));
  const profile = overview.profile;
  const clinic = overview.clinic;
  const name = overview.me?.name ?? '';
  const due = overview.me?.edd ? new Date(overview.me.edd) : null;
  const dueText = due && !Number.isNaN(due.getTime()) ? due.toLocaleDateString(english ? 'en-IN' : undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : '';

  useEffect(() => {
    const previousFocus = opener.current;
    const scrollWas = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab' || !overlay.current) return;
      // Keep the Tab key inside the card while it is open.
      const focusable = [...overlay.current.querySelectorAll<HTMLElement>('button, a[href], select')].filter((el) => !el.hasAttribute('disabled'));
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    const afterPrint = () => document.body.classList.remove('printing-hospital-card');
    document.addEventListener('keydown', keys);
    window.addEventListener('afterprint', afterPrint);
    return () => {
      document.removeEventListener('keydown', keys);
      window.removeEventListener('afterprint', afterPrint);
      document.body.style.overflow = scrollWas;
      document.body.classList.remove('printing-hospital-card');
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
    // Set up once per opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const print = () => {
    document.body.classList.add('printing-hospital-card');
    window.print();
  };

  // Each line appears on the card only when there is something to say; what is missing is listed below for her, not on the card.
  const lines: { label: string; value: string; phone?: string }[] = [];
  if (dueText) lines.push({ label: tx('Estimated due date'), value: dueText });
  if (clinic?.doctorName) lines.push({ label: tx('My doctor'), value: clinic.doctorName });
  if (clinic?.name) lines.push({ label: tx('My clinic'), value: clinic.name });
  if (clinic?.phone) lines.push({ label: tx('Clinic phone'), value: clinic.phone, phone: clinic.phone });
  if (profile.mcpNumber) lines.push({ label: tx('MCP card number'), value: profile.mcpNumber });
  if (profile.contactPhone) {
    lines.push({ label: tx('Emergency contact'), value: [profile.contactName, profile.contactRelation && `(${profile.contactRelation})`].filter(Boolean).join(' ') || profile.contactPhone });
    lines.push({ label: tx('Emergency contact phone'), value: profile.contactPhone, phone: profile.contactPhone });
  }
  const missing = [
    !clinic?.doctorName && tx('My doctor'),
    !clinic?.name && tx('My clinic'),
    !clinic?.phone && tx('Clinic phone'),
    !profile.mcpNumber && tx('MCP card number'),
    !profile.contactPhone && tx('Emergency contact'),
  ].filter((label): label is string => Boolean(label));

  return createPortal(
    <div ref={overlay} className="hospital-card-overlay" role="dialog" aria-modal="true" aria-labelledby="hospital-card-title" lang={english ? 'en' : language}>
      <div className="hospital-card-controls">
        <button ref={closeButton} type="button" className="btn-secondary" onClick={onClose}>
          <X size={16} aria-hidden="true" /> {t('Close')}
        </button>
        {language !== 'en' && (
          <button type="button" className="btn-secondary" aria-pressed={english} onClick={() => setEnglish((on) => !on)}>
            {english ? t('Show in my language') : t('Show in English')}
          </button>
        )}
        <button type="button" className="btn-secondary" onClick={print}>
          <Printer size={16} aria-hidden="true" /> {t('Print this card')}
        </button>
      </div>
      <article className="hospital-card">
        <p className="hospital-card-kicker" id="hospital-card-title">{say(tx('Show this to the hospital'))}</p>
        <p className="hospital-card-name">{name}</p>
        <dl className="hospital-card-lines">
          {lines.map((line) => (
            <div key={line.label}>
              <dt>{say(line.label)}</dt>
              <dd>{line.phone ? <a href={dial(line.phone)}>{line.value}</a> : line.value}</dd>
            </div>
          ))}
        </dl>
        <p className="hospital-card-footer">{say(tx('This card shows only what the patient or her record has entered. It is not a medical record.'))}</p>
      </article>
      {missing.length > 0 && (
        <p className="hospital-card-missing">
          {t('Not on the card yet: {list}. Add them under “My emergency details” on the Emergency help page.', { list: missing.map((label) => t(label)).join(', ') })}
        </p>
      )}
    </div>,
    document.body,
  );
}
