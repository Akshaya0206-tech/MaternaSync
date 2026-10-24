import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Volume2 } from 'lucide-react';
import { api } from '../../api/client';
import { ROOT } from '../../api/continuity';
import { tx, useLanguage } from '../../i18n';
import { Feedback, Field, Page, Panel, useAction, useWorkspace } from '../../components/continuity/shared';
import { SymptomPicker } from './SymptomPicker';
import { canSpeak, speak, stopSpeaking } from './speech';

// A check-in done one question at a time, with large controls and the option to hear each question, for a patient
// who is sitting with an ASHA worker, a nurse or a family member. It saves exactly what the ordinary daily check-in
// saves; the only addition is a note of who helped, so the doctor knows who took the readings.
type Step = 'who' | 'bp' | 'weight' | 'symptoms' | 'mood' | 'medicine' | 'review';
const STEPS: Step[] = ['who', 'bp', 'weight', 'symptoms', 'mood', 'medicine', 'review'];

// The English wording is what the care team reads, whatever language the screen is in.
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

export function GuidedCheckInPage() {
  const { t, language } = useLanguage();
  const workspace = useWorkspace();
  const action = useAction();
  const heading = useRef<HTMLHeadingElement>(null);
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
  const [reading, setReading] = useState<'idle' | 'speaking' | 'no-voice'>('idle');

  const step = STEPS[index];
  const bloodPressureIncomplete = Boolean(systolic) !== Boolean(diastolic);
  const helperChoice = HELPERS.find((h) => h.key === helper)!;
  const enteredWithHelp = helperChoice.recorded ? `${helperChoice.recorded}${helperName.trim() ? `: ${helperName.trim()}` : ''}` : null;

  // The question only exists once the record has loaded, so the first one is focused when it appears.
  const ready = Boolean(workspace.data);
  useEffect(() => {
    if (ready) heading.current?.focus();
    return () => stopSpeaking();
  }, [index, ready]);

  const questions: Record<Step, { title: string; hint?: string }> = {
    who: { title: t('Who is filling this in?'), hint: t('This is only so the care team knows who helped. It is not a login.') },
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

  const go = (next: number) => {
    stopSpeaking();
    setReading('idle');
    setIndex(Math.max(0, Math.min(STEPS.length - 1, next)));
  };

  const save = () =>
    action.run(async () => {
      await api.post(`${ROOT}/episodes/${workspace.episodeId}/logs`, {
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
      setSaved(true);
    }, t('Your check-in was saved for your care team.'));

  const restart = () => {
    setIndex(0); setHelper('self'); setHelperName(''); setSystolic(''); setDiastolic(''); setWeight('');
    setSymptoms(''); setOther(''); setOtherOpen(false); setMood('not_recorded'); setAdherence('not_recorded'); setSaved(false);
  };

  if (saved) {
    return (
      <Page title={t('Step-by-step check-in')}>
        <Panel title={t('Check-in saved.')}>
          <p role="status" className="guided-done">{t('Your check-in was saved for your care team.')}</p>
          <div className="continuity-actions">
            <Link className="btn-primary" to="/patient/daily-log">{t('Back to the daily check-in')}</Link>
            <button className="btn-secondary" onClick={restart}>{t('Fill in another')}</button>
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
    <Page title={t('Step-by-step check-in')} subtitle={t('One question at a time. A health worker or a family member can help. The answers are saved as the patient’s own check-in.')}>
      <Feedback error={workspace.error || action.error} message={action.message} />
      {workspace.data && (
        <section className="glass-panel continuity-panel guided-step" aria-labelledby="guided-question">
          <div className="guided-progress" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={index + 1} aria-label={t('Question {step} of {total}', { step: index + 1, total: STEPS.length })}>
            <span style={{ width: `${((index + 1) / STEPS.length) * 100}%` }} />
          </div>
          <p className="continuity-muted">{t('Question {step} of {total}', { step: index + 1, total: STEPS.length })}</p>
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
              <Field label={t('Systolic BP (mmHg)')}>
                <input type="number" inputMode="numeric" min="30" max="300" value={systolic} onChange={(e) => setSystolic(e.target.value)} />
              </Field>
              <Field label={t('Diastolic BP (mmHg)')}>
                <input type="number" inputMode="numeric" min="20" max="200" value={diastolic} onChange={(e) => setDiastolic(e.target.value)} />
              </Field>
              {bloodPressureIncomplete && <p role="alert" className="continuity-alert">{t('Enter both numbers, or leave both empty.')}</p>}
            </div>
          )}

          {step === 'weight' && (
            <div className="guided-fields">
              <Field label={t('Weight (kg)')}>
                <input type="number" inputMode="decimal" min="20" max="400" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} />
              </Field>
            </div>
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
              <dt>{t('Filled in by')}</dt><dd>{enteredWithHelp ?? t('The patient')}</dd>
            </dl>
          )}

          <div className="guided-actions">
            {index > 0 && <button type="button" className="btn-secondary" onClick={() => go(index - 1)}>{t('Back')}</button>}
            {step !== 'review' && <button type="button" className="btn-primary" disabled={step === 'bp' && bloodPressureIncomplete} onClick={() => go(index + 1)}>{t('Next')}</button>}
            {step === 'review' && <button type="button" className="btn-primary" disabled={action.busy} onClick={() => void save()}>{t('Save check-in')}</button>}
            {skippable && <button type="button" className="guided-skip" onClick={() => go(index + 1)}>{t('Skip this question')}</button>}
          </div>
        </section>
      )}
    </Page>
  );
}
