import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Volume2 } from 'lucide-react';
import { tx, useLanguage } from '../../i18n';
import { Feedback, Field, Page, Panel, useAction } from '../../components/continuity/shared';
import { SymptomPicker } from './SymptomPicker';
import { canSpeak, speak, stopSpeaking } from './speech';
import { checkNumbers } from './checkInRules';

// A check-in done one question at a time, with large controls and the option to hear each question, for a patient
// who is sitting with an ASHA worker, a nurse or a family member. It saves exactly what the ordinary daily check-in
// saves; the only addition is a note of who helped, so the doctor knows who took the readings.
// The same form is used by a trusted person (caregiver) signed in with their own login: there the server records who they
// are from their account, so the "who is filling this in" question is skipped.
type Step = 'who' | 'bp' | 'weight' | 'symptoms' | 'mood' | 'medicine' | 'review';
const ALL_STEPS: Step[] = ['who', 'bp', 'weight', 'symptoms', 'mood', 'medicine', 'review'];

// The English wording is what the doctor reads, whatever language the screen is in.
const HELPERS = [
  { key: 'self', label: tx('I am filling it in myself'), recorded: null },
  { key: 'asha', label: tx('An ASHA worker'), recorded: 'ASHA worker' },
  { key: 'anm', label: tx('An ANM or nurse'), recorded: 'ANM or nurse' },
  { key: 'family', label: tx('A family member'), recorded: 'Family member' },
  { key: 'other', label: tx('Someone else'), recorded: 'Someone else' },
];
const MOODS = [
  { value: 'good', label: tx('Good') },
  { value: 'okay', label: tx('Okay') },
  { value: 'low', label: tx('Low') },
  { value: 'anxious', label: tx('Anxious') },
];
const MEDICINES = [
  { value: 'done', label: tx('Done') },
  { value: 'skipped', label: tx('Skipped') },
  { value: 'needs_help', label: tx('I need help') },
];

export interface CheckInBody {
  recordedAt: string;
  systolic: number | null;
  diastolic: number | null;
  weightKg: number | null;
  symptoms: string;
  mood: string;
  adherence: string;
  skipped: boolean;
  movementCount: null;
  movementMinutes: null;
  correctionReason: string;
  enteredWithHelp: string | null;
}

/** What has been answered so far, kept on this device so a check-in that is interrupted can be carried on. */
interface Draft {
  savedAt: string;
  index: number;
  helper: string;
  helperName: string;
  systolic: string;
  diastolic: string;
  weight: string;
  symptoms: string;
  other: string;
  otherOpen: boolean;
  mood: string;
  adherence: string;
}
const DRAFT_LIFETIME_MS = 24 * 60 * 60 * 1000; // a check-in left for a day is about a different day

function readDraft(key?: string): Draft | null {
  if (!key) return null;
  try {
    const draft = JSON.parse(localStorage.getItem(key) ?? 'null') as Draft | null;
    if (!draft || Date.now() - new Date(draft.savedAt).getTime() > DRAFT_LIFETIME_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

function writeDraft(key: string, draft: Draft | null) {
  try {
    if (draft) localStorage.setItem(key, JSON.stringify(draft));
    else localStorage.removeItem(key);
  } catch {
    // The phone's storage is full or blocked: the check-in simply cannot be carried on later.
  }
}

interface Props {
  /** The record has loaded, so the first question can be focused. */
  ready: boolean;
  error?: string;
  /** Returns text to show in place of `savedText` (for example, that the check-in is waiting on the phone for a signal). */
  save: (body: CheckInBody) => Promise<void | string>;
  /** Skip the "who is filling this in" question (a trusted person's own login already says who). */
  skipWho?: boolean;
  /** Shown on the last question in place of "The patient". */
  filledInBy?: string;
  subtitle: string;
  savedText: string;
  doneTo: string;
  doneLabel: string;
  /** Where this device keeps an unfinished check-in. Leave out to keep none. */
  draftKey?: string;
  /** Offer to read the "please check this number" message aloud (a trusted person asked for it; the patient's form is unchanged without it). */
  readAloudChecks?: boolean;
}

export function GuidedCheckInForm({ ready, error, save: send, skipWho = false, filledInBy, subtitle, savedText, doneTo, doneLabel, draftKey, readAloudChecks = false }: Props) {
  const { t, language } = useLanguage();
  const action = useAction();
  const heading = useRef<HTMLHeadingElement>(null);
  const steps = skipWho ? ALL_STEPS.filter((s) => s !== 'who') : ALL_STEPS;
  const [draft, setDraft] = useState<Draft | null>(() => readDraft(draftKey));
  const [resuming, setResuming] = useState(Boolean(draft));
  const [index, setIndex] = useState(0);
  const [helper, setHelper] = useState('self');
  const [helperName, setHelperName] = useState('');
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [weight, setWeight] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [other, setOther] = useState('');
  const [otherOpen, setOtherOpen] = useState(false);
  const [mood, setMood] = useState('not_recorded');
  const [adherence, setAdherence] = useState('not_recorded');
  const [saved, setSaved] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [attempted, setAttempted] = useState<Step[]>([]);
  const [reading, setReading] = useState<'idle' | 'speaking' | 'no-voice'>('idle');
  const [checkReading, setCheckReading] = useState<'idle' | 'speaking' | 'no-voice'>('idle');

  const step = steps[Math.min(index, steps.length - 1)];
  const errors = checkNumbers({ systolic, diastolic, weightKg: weight, movementCount: '', movementMinutes: '' }, t);
  const stepErrors = { bp: Boolean(errors.systolic || errors.diastolic), weight: Boolean(errors.weightKg) };
  const showErrors = (which: Step) => attempted.includes(which);
  const helperChoice = HELPERS.find((h) => h.key === helper)!;
  const enteredWithHelp = skipWho ? null : helperChoice.recorded ? `${helperChoice.recorded}${helperName.trim() ? `: ${helperName.trim()}` : ''}` : null;

  // The question only exists once the record has loaded, so the first one is focused when it appears.
  useEffect(() => {
    if (ready && !resuming) heading.current?.focus();
    return () => stopSpeaking();
  }, [index, ready, resuming]);

  // Keep what has been answered, so a check-in that is interrupted (a call, a lost signal, a closed tab) can be carried on.
  useEffect(() => {
    if (!draftKey || saved || resuming) return;
    const untouched = index === 0 && helper === 'self' && !helperName && !systolic && !diastolic && !weight && !symptoms && !other && mood === 'not_recorded' && adherence === 'not_recorded';
    writeDraft(draftKey, untouched ? null : { savedAt: new Date().toISOString(), index, helper, helperName, systolic, diastolic, weight, symptoms, other, otherOpen, mood, adherence });
  }, [draftKey, saved, resuming, index, helper, helperName, systolic, diastolic, weight, symptoms, other, otherOpen, mood, adherence]);

  const questions: Record<Step, { title: string; hint?: string }> = {
    who: { title: t('Who is filling this in?'), hint: t('This is only so the doctor knows who helped. It is not a login.') },
    bp: { title: t('What is the blood pressure reading?'), hint: t('Two numbers from the machine, for example 120 and 80. Leave both empty if there is no reading today.') },
    weight: { title: t('What is the weight today?') },
    symptoms: { title: t('Any symptoms today?') },
    mood: { title: t('How are you feeling today?') },
    medicine: { title: t('Were the medicines taken today?') },
    review: { title: t('Check the answers') },
  };
  const question = questions[step];

  const readAloud = () => {
    if (reading === 'speaking') {
      stopSpeaking();
      setReading('idle');
      return;
    }
    const result = speak([question.title, question.hint].filter(Boolean).join('. '), language, () => setReading('idle'));
    setReading(result === 'speaking' ? 'speaking' : 'no-voice');
  };

  // The "please check this number" message for the question on screen, once she has tried to move on from it.
  const checkText = !showErrors(step) ? '' : step === 'bp' ? [errors.systolic, errors.diastolic].filter(Boolean).join(' ') : step === 'weight' ? errors.weightKg ?? '' : '';
  const readCheckAloud = () => {
    if (checkReading === 'speaking') {
      stopSpeaking();
      setCheckReading('idle');
      return;
    }
    const result = speak(checkText, language, () => setCheckReading('idle'));
    setCheckReading(result === 'speaking' ? 'speaking' : 'no-voice');
  };

  const go = (next: number) => {
    stopSpeaking();
    setReading('idle');
    setCheckReading('idle');
    setIndex(Math.max(0, Math.min(steps.length - 1, next)));
  };

  // Moving on from a question with a number that cannot be right stays where it is and says which box to look at.
  const next = () => {
    if ((step === 'bp' && stepErrors.bp) || (step === 'weight' && stepErrors.weight)) {
      setAttempted((old) => [...old, step]);
      return;
    }
    go(index + 1);
  };

  // "Skip this question" means no answer, so a number that was typed and is not valid is cleared rather than carried along.
  const skip = () => {
    if (step === 'bp' && stepErrors.bp) { setSystolic(''); setDiastolic(''); }
    if (step === 'weight' && stepErrors.weight) setWeight('');
    go(index + 1);
  };

  const save = () => {
    const bad: Step | null = stepErrors.bp ? 'bp' : stepErrors.weight ? 'weight' : null;
    if (bad) {
      setAttempted((old) => [...old, bad]);
      go(steps.indexOf(bad));
      return Promise.resolve();
    }
    return action.run(async () => {
      const own = await send({
        recordedAt: new Date(Date.now() - 1000).toISOString(),
        systolic: systolic ? Number(systolic) : null,
        diastolic: diastolic ? Number(diastolic) : null,
        weightKg: weight ? Number(weight) : null,
        symptoms: [symptoms, other.trim()].filter(Boolean).join(', '),
        mood,
        adherence,
        skipped: false,
        movementCount: null,
        movementMinutes: null,
        correctionReason: '',
        enteredWithHelp,
      });
      if (draftKey) writeDraft(draftKey, null);
      setSavedMessage(typeof own === 'string' ? own : '');
      setSaved(true);
    }, savedText);
  };

  const restart = () => {
    setIndex(0); setHelper('self'); setHelperName(''); setSystolic(''); setDiastolic(''); setWeight('');
    setSymptoms(''); setOther(''); setOtherOpen(false); setMood('not_recorded'); setAdherence('not_recorded'); setSaved(false);
    setSavedMessage(''); setAttempted([]);
  };

  const carryOn = () => {
    if (draft) {
      setIndex(Math.min(draft.index, steps.length - 1)); setHelper(draft.helper); setHelperName(draft.helperName); setSystolic(draft.systolic); setDiastolic(draft.diastolic);
      setWeight(draft.weight); setSymptoms(draft.symptoms); setOther(draft.other); setOtherOpen(draft.otherOpen); setMood(draft.mood); setAdherence(draft.adherence);
    }
    setResuming(false);
  };

  const startAgain = () => {
    if (draftKey) writeDraft(draftKey, null);
    setDraft(null);
    setResuming(false);
  };

  if (saved) {
    return (
      <Page title={t('Step-by-step check-in')}>
        <Panel title={savedMessage ? t('Check-in kept on this phone.') : t('Check-in saved.')}>
          <p role="status" className="guided-done">{savedMessage || savedText}</p>
          <div className="continuity-actions">
            <Link className="btn-primary" to={doneTo}>{doneLabel}</Link>
            <button className="btn-secondary" onClick={restart}>{t('Fill in another')}</button>
          </div>
        </Panel>
      </Page>
    );
  }

  if (resuming && ready && draft) {
    return (
      <Page title={t('Step-by-step check-in')} subtitle={subtitle}>
        <Panel title={t('Carry on where you stopped?')}>
          <p>{t('A check-in was started on this phone and not finished. It was kept so you can carry on from where you stopped.')}</p>
          <div className="continuity-actions">
            <button type="button" className="btn-primary" onClick={carryOn}>{t('Carry on')}</button>
            <button type="button" className="btn-secondary" onClick={startAgain}>{t('Start again')}</button>
          </div>
        </Panel>
      </Page>
    );
  }

  const skippable = step !== 'who' && step !== 'review';
  const choose = (value: string, current: string, set: (v: string) => void, label: string) => (
    <button key={value} type="button" className="guided-option" aria-pressed={current === value} onClick={() => set(current === value ? 'not_recorded' : value)}>
      {label}
    </button>
  );

  return (
    <Page title={t('Step-by-step check-in')} subtitle={subtitle}>
      <Feedback error={error || action.error} message={action.message} />
      {ready && (
        <section className="glass-panel continuity-panel guided-step" aria-labelledby="guided-question">
          <div className="guided-progress" role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={index + 1} aria-label={t('Question {step} of {total}', { step: index + 1, total: steps.length })}>
            <span style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
          </div>
          <p className="continuity-muted">{t('Question {step} of {total}', { step: index + 1, total: steps.length })}</p>
          <h2 id="guided-question" ref={heading} tabIndex={-1}>{question.title}</h2>
          {question.hint && <p className="continuity-muted">{question.hint}</p>}
          {canSpeak() && (
            <button type="button" className="btn-secondary" aria-pressed={reading === 'speaking'} onClick={readAloud}>
              <Volume2 size={16} aria-hidden="true" /> {reading === 'speaking' ? t('Stop reading') : t('Read aloud')}
            </button>
          )}
          {reading === 'no-voice' && <p role="status" className="continuity-muted">{t('Your device has no voice installed for this language.')}</p>}

          {step === 'who' && (
            <>
              <div className="guided-options" role="group" aria-label={question.title}>
                {HELPERS.map((h) => (
                  <button key={h.key} type="button" className="guided-option" aria-pressed={helper === h.key} onClick={() => setHelper(h.key)}>{t(h.label)}</button>
                ))}
              </div>
              {helper !== 'self' && (
                <div className="guided-fields">
                  <Field label={t('Their name (optional)')}>
                    <input maxLength={60} value={helperName} onChange={(e) => setHelperName(e.target.value)} autoComplete="off" />
                  </Field>
                </div>
              )}
            </>
          )}

          {step === 'bp' && (
            <div className="guided-fields">
              <Field label={t('Systolic BP (mmHg)')} error={showErrors('bp') ? errors.systolic : undefined}>
                <input type="number" inputMode="numeric" value={systolic} onChange={(e) => setSystolic(e.target.value)} />
              </Field>
              <Field label={t('Diastolic BP (mmHg)')} error={showErrors('bp') ? errors.diastolic : undefined}>
                <input type="number" inputMode="numeric" value={diastolic} onChange={(e) => setDiastolic(e.target.value)} />
              </Field>
            </div>
          )}

          {step === 'weight' && (
            <div className="guided-fields">
              <Field label={t('Weight (kg)')} error={showErrors('weight') ? errors.weightKg : undefined}>
                <input type="number" inputMode="decimal" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} />
              </Field>
            </div>
          )}

          {readAloudChecks && canSpeak() && checkText && (
            <>
              <button type="button" className="btn-secondary" aria-pressed={checkReading === 'speaking'} onClick={readCheckAloud}>
                <Volume2 size={16} aria-hidden="true" /> {checkReading === 'speaking' ? t('Stop reading') : t('Read the message aloud')}
              </button>
              {checkReading === 'no-voice' && <p role="status" className="continuity-muted">{t('Your device has no voice installed for this language.')}</p>}
            </>
          )}

          {step === 'symptoms' && (
            <SymptomPicker symptoms={symptoms} other={other} otherOpen={otherOpen} onSymptoms={setSymptoms} onOther={setOther} onOtherOpen={setOtherOpen} />
          )}

          {step === 'mood' && (
            <div className="guided-options" role="group" aria-label={question.title}>
              {MOODS.map((m) => choose(m.value, mood, setMood, t(m.label)))}
            </div>
          )}

          {step === 'medicine' && (
            <div className="guided-options" role="group" aria-label={question.title}>
              {MEDICINES.map((m) => choose(m.value, adherence, setAdherence, t(m.label)))}
            </div>
          )}

          {step === 'review' && (
            <dl className="guided-review">
              <dt>{t('BP')}</dt><dd>{systolic ? `${systolic}/${diastolic} mmHg` : t('Not recorded')}</dd>
              <dt>{t('Weight')}</dt><dd>{weight ? `${weight} kg` : t('Not recorded')}</dd>
              <dt>{t('Symptoms')}</dt><dd>{[symptoms, other.trim()].filter(Boolean).join(', ') || t('No symptoms entered')}</dd>
              <dt>{t('Mood')}</dt><dd>{mood === 'not_recorded' ? t('Not recorded') : t(MOODS.find((m) => m.value === mood)?.label ?? mood)}</dd>
              <dt>{t('Adherence')}</dt><dd>{adherence === 'not_recorded' ? t('Not recorded') : t(MEDICINES.find((m) => m.value === adherence)?.label ?? adherence)}</dd>
              <dt>{t('Filled in by')}</dt><dd>{filledInBy ?? enteredWithHelp ?? t('The patient')}</dd>
            </dl>
          )}

          <div className="guided-actions">
            {index > 0 && <button type="button" className="btn-secondary" onClick={() => go(index - 1)}>{t('Back')}</button>}
            {step !== 'review' && <button type="button" className="btn-primary" onClick={next}>{t('Next')}</button>}
            {step === 'review' && <button type="button" className="btn-primary" disabled={action.busy} onClick={() => void save()}>{t('Save check-in')}</button>}
            {skippable && <button type="button" className="guided-skip" onClick={skip}>{t('Skip this question')}</button>}
          </div>
        </section>
      )}
    </Page>
  );
}
