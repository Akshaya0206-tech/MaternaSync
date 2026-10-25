import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  assistantActivity, assistantItems, assistantStatus, changeAssistantSettings, decideAssistantItem, pauseAssistantForPatient,
  resumeAssistantForPatient, runAssistantNow, undoAssistantAction,
} from '../../api/assistant';
import type { AssistantAction, AssistantItem, AssistantStatus } from '../../api/assistant';
import { formatTime, getContext } from '../../api/continuity';
import { Badge, Empty, Feedback, Field, Page, Panel, useAction } from '../../components/continuity/shared';
import { AssistantBookingRules } from './AssistantBookingRules';
import { AssistantCounts } from './AssistantCounts';
import { tx, useLanguage } from '../../i18n';

const MODE_TEXT: Record<AssistantStatus['mode'], string> = {
  off: tx('Switched off. It does nothing and queues nothing.'),
  shadow: tx('Shadow. It works out what it would do and records that, but changes nothing.'),
  assist: tx('Assist. It does safe administrative steps by itself and proposes the rest for you to approve.'),
};

const WORKFLOW_TEXT: Record<string, string> = {
  document_intake: tx('Document intake'),
  question_routing: tx('Question routing'),
  missed_checkin: tx('Missed check-in reminder'),
  overdue_task: tx('Overdue task'),
  appointment_request: tx('Visit request'),
  referral_followup: tx('New referral'),
  paperwork: tx('Visit summary draft'),
  visit_reminder: tx('Visit reminder'),
  missed_visit: tx('Past visit check'),
  referral_chase: tx('Referral follow-up'),
  outreach: tx('WhatsApp reminder'),
  handover: tx('Handover draft'),
  weekly_summary: tx('Weekly counts'),
};

const TOOL_TEXT: Record<string, string> = {
  create_attention: tx('Handed to a doctor'),
  notify_user: tx('Sent a fixed reminder'),
  send_urgent_message: tx('Showed the fixed emergency message'),
  assign_question_to_doctor: tx('Assigned a question to a doctor'),
  verify_document: tx('Verify a document'),
  reject_document: tx('Reject a document'),
  answer_question: tx('Send a reply'),
  confirm_appointment: tx('Confirm a visit'),
  offer_new_times: tx('Offer other times'),
  record_missed_visit: tx('Record a missed visit'),
  send_referral: tx('Send a referral'),
  chase_referral: tx('Chase a referral'),
  send_outreach: tx('Send a WhatsApp reminder'),
  prepare_draft: tx('Prepare a draft'),
  prepare_handover: tx('Prepare a handover draft'),
  post_weekly_summary: tx('Post the weekly counts'),
};

const OUTCOME_TEXT: Record<string, string> = {
  DONE: tx('Done'),
  PROPOSED: tx('Waiting for a doctor'),
  SHADOW: tx('Recorded only'),
  DENIED: tx('Stopped'),
  FAILED: tx('Failed'),
  UNDONE: tx('Undone'),
};

// What the page says before a step is undone, so a doctor knows what changes. The emergency message gets a stronger warning.
const UNDO_TEXT: Record<string, string> = {
  create_attention: tx('This dismisses the hand-off. Nothing is sent to anyone.'),
  notify_user: tx('This withdraws the reminder from the person’s Updates.'),
  send_urgent_message: tx('This withdraws the fixed emergency message from her Updates. Only do this if you have already reached her, because she may not have seen it yet.'),
  assign_question_to_doctor: tx('This puts the question back as it was, unassigned.'),
  verify_document: tx('This puts the document back under review and removes it from her journey.'),
  reject_document: tx('This puts the document back under review and withdraws the message asking her to upload it again.'),
  answer_question: tx('This withdraws the reply and opens the question again. She will no longer see it.'),
  confirm_appointment: tx('This puts the visit back to a request and withdraws the confirmation from her Updates.'),
  offer_new_times: tx('This reopens her request and withdraws the message with the other times from her Updates.'),
  record_missed_visit: tx('This puts the visit back to scheduled and withdraws the missed-visit message from her Updates.'),
  chase_referral: tx("This removes the reminder from the referral's messages."),
  send_outreach: tx('This cancels the prepared WhatsApp message.'),
  prepare_draft: tx('This deletes the draft, if nobody has edited it yet.'),
  prepare_handover: tx('This deletes the handover draft and makes the earlier draft current again.'),
  post_weekly_summary: tx('This removes the message from your Updates.'),
};

/** The doctor's side of the care assistant: what it did, what it proposes, what it handed over, and the controls to pause it or undo a step. */
export function AssistantPage() {
  const { t } = useLanguage();
  const [status, setStatus] = useState<AssistantStatus | null>(null);
  const [open, setOpen] = useState<AssistantItem[] | null>(null);
  const [decided, setDecided] = useState<AssistantItem[]>([]);
  const [log, setLog] = useState<AssistantAction[]>([]);
  const [patients, setPatients] = useState<{ id: string; patientName: string }[]>([]);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');
  const [pausePick, setPausePick] = useState('');
  const [undoing, setUndoing] = useState('');
  const [undoNote, setUndoNote] = useState('');
  const action = useAction();

  const load = useCallback(async () => {
    try {
      const [s, items, history, activity] = await Promise.all([assistantStatus(), assistantItems('open'), assistantItems('all'), assistantActivity()]);
      setStatus(s);
      setOpen(items);
      setDecided(history.filter((i) => i.status !== 'OPEN').slice(0, 20));
      setLog(activity);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('We could not load the care assistant. Please try again.'));
      setOpen((previous) => previous ?? []);
    }
  }, [t]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    getContext().then((context) => setPatients(context.episodes.map((e) => ({ id: e.id, patientName: e.patientName })))).catch(() => undefined);
  }, []);

  const decide = (item: AssistantItem, decision: 'approve' | 'dismiss' | 'acknowledge') =>
    action.run(async () => {
      setNotice('');
      const done = await decideAssistantItem(item.id, decision, notes[item.id] ?? '');
      setNotes((previous) => ({ ...previous, [item.id]: '' }));
      await load();
      // For example "This was already handled by someone else, so it was closed."
      if (decision === 'approve' && done.message) setNotice(t(done.message));
    }, decision === 'approve' ? t('Approved. The record shows you decided this.') : decision === 'dismiss' ? t('Dismissed. Nothing was done.') : t('Marked as seen.'));

  // The switch moves at once and the save follows; if the save fails the page is loaded again, which puts the real setting back.
  const change = (body: { paused?: boolean; reviewAll?: boolean }, success: string) => {
    setStatus((current) => current && { ...current, ...body });
    return action.run(async () => {
      try {
        setStatus(await changeAssistantSettings(body));
      } catch (err) {
        await load();
        throw err;
      }
      await load();
    }, success);
  };

  const undo = (row: AssistantAction) =>
    action.run(async () => {
      setNotice('');
      const done = await undoAssistantAction(row.id, undoNote.trim());
      setUndoing('');
      setUndoNote('');
      await load();
      setNotice(t(done.message));
    }, t('Undone. The record shows you reversed this step.'));

  const pausedIds = new Set(status?.pausedPatients.map((p) => p.episodeId));
  const pausable = patients.filter((p) => !pausedIds.has(p.id));

  return (
    <Page title={t('Care assistant')} subtitle={t('Does the routine administrative work and hands the rest to you. It never diagnoses, never advises on treatment and never answers a clinical question. Every step is recorded below.')}>
      <Feedback error={error || action.error} message={action.message} />
      {notice && <p role="status" className="continuity-note">{notice}</p>}

      {status?.paused && (
        <div role="status" className="continuity-note assistant-paused">
          <strong>{t('The assistant is paused.')}</strong>{' '}
          {t('{name} paused it. New work waits until it is resumed. A question with a warning sign still gets the fixed emergency message, and every new question is still handed to the doctor.', { name: status.pausedBy ?? t('A doctor') })}
        </div>
      )}

      {status && (
        <Panel
          title={t('Status')}
          aside={
            <button className="btn-secondary" disabled={action.busy || status.mode === 'off'} onClick={() => void action.run(async () => { await runAssistantNow(); await load(); }, t('Checked now.'))}>
              {t('Check now')}
            </button>
          }
        >
          <dl className="assistant-status">
            <dt>{t('Mode')}</dt><dd>{t(MODE_TEXT[status.mode])}</dd>
            <dt>{t('Model step')}</dt>
            <dd>{status.provider === 'claude' ? t('Claude ({model}). Names and record numbers are removed before anything is sent.', { model: status.model ?? '' }) : t('Built-in rules. Nothing leaves this server.')}</dd>
            <dt>{t('Waiting for you')}</dt><dd>{t('{open} ({proposals} to approve, {urgent} urgent)', { open: status.open, proposals: status.proposals, urgent: status.urgent })}</dd>
            <dt>{t('Handled today')}</dt><dd>{t('{count} routine steps', { count: status.handledToday })}</dd>
            {(status.paused || status.pausedPatients.length > 0) && <><dt>{t('Held back')}</dt><dd>{t('{count} job(s) are waiting for you to resume', { count: status.waiting })}</dd></>}
            <dt>{t('Handover drafts')}</dt>
            <dd>{status.handoverPaused ? t('Handover is paused, so the assistant prepares none.') : t('On. It prepares a draft from open tasks, visit requests and questions, and you edit and share it.')}</dd>
          </dl>
          <p className="continuity-muted">
            {t('To switch it off at once, set MATERNASYNC_AI_COORDINATOR_MODE=off and restart the API. The “Talk to a person” buttons for patients and trusted people keep working either way.')}
          </p>
        </Panel>
      )}

      {status && (
        <Panel title={t('Your controls')}>
          <p className="continuity-muted">{t('You can stop the assistant, make it ask first, or reverse any step it has taken. Nothing it does is final.')}</p>
          <div className="continuity-actions">
            <button className={status.paused ? 'btn-primary' : 'btn-secondary'} disabled={action.busy}
              onClick={() => void change({ paused: !status.paused }, status.paused ? t('The assistant is running again.') : t('The assistant is paused.'))}>
              {status.paused ? t('Resume the assistant') : t('Pause the assistant')}
            </button>
          </div>
          <label className="trusted-permission assistant-toggle">
            <input type="checkbox" checked={status.reviewAll} disabled={action.busy}
              onChange={(e) => void change({ reviewAll: e.target.checked }, e.target.checked ? t('Every routine step now waits for your approval.') : t('Routine steps run by themselves again.'))} />
            <span>
              {t('Ask me to approve every step first')}
              <span className="continuity-muted"> {t('Reminders to patients wait for your approval. Handing a question to a doctor and the fixed emergency message are never held back.')}</span>
            </span>
          </label>
          <h3 className="assistant-subheading">{t('Pause for one patient')}</h3>
          <div className="assistant-pause-row">
            <Field label={t('Patient')}>
              <select value={pausePick} onChange={(e) => setPausePick(e.target.value)}>
                <option value="">{t('Choose a patient')}</option>
                {pausable.map((p) => <option key={p.id} value={p.id}>{p.patientName}</option>)}
              </select>
            </Field>
            <button className="btn-secondary" disabled={action.busy || !pausePick}
              onClick={() => void action.run(async () => { setStatus(await pauseAssistantForPatient(pausePick)); setPausePick(''); await load(); }, t('Paused for this patient.'))}>
              {t('Pause for this patient')}
            </button>
          </div>
          {status.pausedPatients.length > 0 && (
            <ul className="continuity-list" aria-label={t('Patients the assistant is paused for')}>
              {status.pausedPatients.map((p) => (
                <li key={p.episodeId}>
                  {p.patientName}{' '}
                  <button className="btn-secondary assistant-small" disabled={action.busy}
                    onClick={() => void action.run(async () => { setStatus(await resumeAssistantForPatient(p.episodeId)); await load(); }, t('Resumed for this patient.'))}>
                    {t('Resume')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      <AssistantBookingRules />

      <Panel title={t('Needs you')}>
        {open === null && !error && <p role="status" className="continuity-muted">{t('Loading…')}</p>}
        {open && !open.length && <Empty>{t('Nothing is waiting for you.')}</Empty>}
        {open?.map((item) => (
          <article key={item.id} className={`continuity-item assistant-item${item.urgency === 'urgent' ? ' assistant-urgent' : ''}`}>
            <h3>
              {t(item.title)} {item.urgency === 'urgent' && <Badge>{t('Urgent')}</Badge>} <Badge>{item.kind === 'proposal' ? t('Proposal') : t('Needs a person')}</Badge>
            </h3>
            <p className="continuity-muted">
              <Link to={`/doctor/patients/${item.episodeId}`}>{item.patientName}</Link> · {formatTime(item.createdAt)}
            </p>
            <div className="continuity-copy">{item.summary}</div>
            {item.preview && <blockquote className="assistant-preview">{item.preview}</blockquote>}
            {item.recommendedAction && <p><strong>{t('Suggested:')}</strong> {t(item.recommendedAction)}</p>}
            <label className="assistant-note">
              <span className="continuity-muted">{t('Note (optional)')}</span>
              <input value={notes[item.id] ?? ''} maxLength={500} onChange={(e) => setNotes({ ...notes, [item.id]: e.target.value })} />
            </label>
            <div className="continuity-actions">
              {item.kind === 'proposal'
                ? <button className="btn-primary" disabled={action.busy} onClick={() => void decide(item, 'approve')}>{t('Approve')}</button>
                : <button className="btn-primary" disabled={action.busy} onClick={() => void decide(item, 'acknowledge')}>{t('I have seen this')}</button>}
              <button className="btn-secondary" disabled={action.busy} onClick={() => void decide(item, 'dismiss')}>{t('Dismiss')}</button>
            </div>
          </article>
        ))}
      </Panel>

      <Panel title={t('Recently decided')}>
        {!decided.length && <Empty>{t('Nothing yet.')}</Empty>}
        {decided.map((item) => (
          <article key={item.id} className="continuity-item">
            <h3>{t(item.title)} <Badge>{item.status === 'APPROVED' ? t('Approved') : item.status === 'DISMISSED' ? t('Dismissed') : t('Seen')}</Badge></h3>
            <p className="continuity-muted">{item.patientName} · {item.decidedBy ?? t('a doctor')} · {formatTime(item.decidedAt)}{item.decisionNote ? ` · “${item.decisionNote}”` : ''}</p>
          </article>
        ))}
      </Panel>

      <AssistantCounts refresh={log.length + decided.length} />

      <Panel title={t('What the assistant did')}>
        {!log.length && <Empty>{t('It has not done anything yet.')}</Empty>}
        {!!log.length && (
          <div className="assistant-log-wrap">
            <table className="assistant-log">
              <thead>
                <tr>
                  <th scope="col">{t('When')}</th><th scope="col">{t('Patient')}</th><th scope="col">{t('Work')}</th><th scope="col">{t('Step')}</th>
                  <th scope="col">{t('Result')}</th><th scope="col">{t('Why')}</th><th scope="col">{t('Your override')}</th>
                </tr>
              </thead>
              <tbody>
                {log.map((row) => (
                  <tr key={row.id}>
                    <td>{formatTime(row.createdAt)}</td>
                    <td>{row.patientName}</td>
                    <td>{t(WORKFLOW_TEXT[row.workflow] ?? row.workflow)}</td>
                    <td>{t(TOOL_TEXT[row.tool] ?? row.tool)}</td>
                    <td>{t(OUTCOME_TEXT[row.status] ?? row.status)}{row.executedBy && row.status === 'DONE' ? ` · ${row.executedBy}` : ''}</td>
                    <td>{t(row.reason)}{row.result && row.status === 'FAILED' ? ` ${row.result}` : ''}</td>
                    <td>
                      {row.status === 'UNDONE' && (
                        <span>{t('Undone by {name}', { name: row.undoneBy ?? t('a doctor') })}{row.undoNote ? `: “${row.undoNote}”` : ''}</span>
                      )}
                      {row.undoable && undoing !== row.id && (
                        <button className="btn-secondary assistant-small" disabled={action.busy} onClick={() => { setUndoing(row.id); setUndoNote(''); }}>{t('Undo')}</button>
                      )}
                      {row.undoable && undoing === row.id && (
                        <div className="assistant-undo">
                          <p>{t(UNDO_TEXT[row.tool] ?? '')}</p>
                          <label className="assistant-note">
                            <span className="continuity-muted">{t('Why? (optional)')}</span>
                            <input value={undoNote} maxLength={500} onChange={(e) => setUndoNote(e.target.value)} />
                          </label>
                          <div className="continuity-actions">
                            <button className="btn-primary assistant-small" disabled={action.busy} onClick={() => void undo(row)}>{t('Undo this step')}</button>
                            <button className="btn-secondary assistant-small" disabled={action.busy} onClick={() => setUndoing('')}>{t('Cancel')}</button>
                          </div>
                        </div>
                      )}
                      {!row.undoable && row.status !== 'UNDONE' && <span className="continuity-muted">{row.status === 'DONE' ? t('Cannot be undone') : '—'}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </Page>
  );
}
