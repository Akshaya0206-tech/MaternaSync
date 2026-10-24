import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { assistantActivity, assistantItems, assistantStatus, decideAssistantItem, runAssistantNow } from '../../api/assistant';
import type { AssistantAction, AssistantItem, AssistantStatus } from '../../api/assistant';
import { formatTime } from '../../api/continuity';
import { Badge, Empty, Feedback, Page, Panel, useAction } from '../../components/continuity/shared';

const MODE_TEXT: Record<AssistantStatus['mode'], string> = {
  off: 'Switched off. It does nothing and queues nothing.',
  shadow: 'Shadow. It works out what it would do and records that, but changes nothing.',
  assist: 'Assist. It does safe administrative steps by itself and proposes the rest for you to approve.',
};

const WORKFLOW_TEXT: Record<string, string> = {
  document_intake: 'Document intake',
  question_routing: 'Question routing',
  missed_checkin: 'Missed check-in reminder',
  overdue_task: 'Overdue task',
};

const TOOL_TEXT: Record<string, string> = {
  create_attention: 'Handed to a doctor',
  notify_user: 'Sent a fixed reminder',
  send_urgent_message: 'Showed the fixed emergency message',
  assign_question_to_doctor: 'Assigned a question to a doctor',
  verify_document: 'Verify a document',
  reject_document: 'Reject a document',
  answer_question: 'Send a reply',
};

const OUTCOME_TEXT: Record<string, string> = {
  DONE: 'Done',
  PROPOSED: 'Waiting for a doctor',
  SHADOW: 'Recorded only',
  DENIED: 'Stopped',
  FAILED: 'Failed',
};

/** The doctor's side of the care assistant: what it did, what it proposes, and what it handed over. */
export function AssistantPage() {
  const [status, setStatus] = useState<AssistantStatus | null>(null);
  const [open, setOpen] = useState<AssistantItem[] | null>(null);
  const [decided, setDecided] = useState<AssistantItem[]>([]);
  const [log, setLog] = useState<AssistantAction[]>([]);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');
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
      setError(err instanceof Error ? err.message : 'We could not load the care assistant. Please try again.');
      setOpen((previous) => previous ?? []);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const decide = (item: AssistantItem, decision: 'approve' | 'dismiss' | 'acknowledge') =>
    action.run(async () => {
      setNotice('');
      const done = await decideAssistantItem(item.id, decision, notes[item.id] ?? '');
      setNotes((previous) => ({ ...previous, [item.id]: '' }));
      await load();
      // For example "This was already handled by someone else, so it was closed."
      if (decision === 'approve' && done.message) setNotice(done.message);
    }, decision === 'approve' ? 'Approved. The record shows you decided this.' : decision === 'dismiss' ? 'Dismissed. Nothing was done.' : 'Marked as seen.');

  return (
    <Page title="Care assistant" subtitle="Does the routine administrative work and hands the rest to you. It never diagnoses, never advises on treatment and never answers a clinical question. Every step is recorded below.">
      <Feedback error={error || action.error} message={action.message} />
      {notice && <p role="status" className="continuity-note">{notice}</p>}

      {status && (
        <Panel
          title="Status"
          aside={
            <button className="btn-secondary" disabled={action.busy || status.mode === 'off'} onClick={() => void action.run(async () => { await runAssistantNow(); await load(); }, 'Checked now.')}>
              Check now
            </button>
          }
        >
          <dl className="assistant-status">
            <dt>Mode</dt><dd>{MODE_TEXT[status.mode]}</dd>
            <dt>Model step</dt>
            <dd>{status.provider === 'claude' ? `Claude (${status.model}). Names and record numbers are removed before anything is sent.` : 'Built-in rules. Nothing leaves this server.'}</dd>
            <dt>Waiting for you</dt><dd>{status.open} ({status.proposals} to approve, {status.urgent} urgent)</dd>
            <dt>Handled today</dt><dd>{status.handledToday} routine steps</dd>
          </dl>
          <p className="continuity-muted">
            To switch it off at once, set MATERNASYNC_AI_COORDINATOR_MODE=off and restart the API. The “Talk to a person” buttons for patients and trusted people keep working either way.
          </p>
        </Panel>
      )}

      <Panel title="Needs you">
        {open === null && !error && <p role="status" className="continuity-muted">Loading…</p>}
        {open && !open.length && <Empty>Nothing is waiting for you.</Empty>}
        {open?.map((item) => (
          <article key={item.id} className={`continuity-item assistant-item${item.urgency === 'urgent' ? ' assistant-urgent' : ''}`}>
            <h3>
              {item.title} {item.urgency === 'urgent' && <Badge>Urgent</Badge>} <Badge>{item.kind === 'proposal' ? 'Proposal' : 'Needs a person'}</Badge>
            </h3>
            <p className="continuity-muted">
              <Link to={`/doctor/patients/${item.episodeId}`}>{item.patientName}</Link> · {formatTime(item.createdAt)}
            </p>
            <div className="continuity-copy">{item.summary}</div>
            {item.preview && <blockquote className="assistant-preview">{item.preview}</blockquote>}
            {item.recommendedAction && <p><strong>Suggested:</strong> {item.recommendedAction}</p>}
            <label className="assistant-note">
              <span className="continuity-muted">Note (optional)</span>
              <input value={notes[item.id] ?? ''} maxLength={500} onChange={(e) => setNotes({ ...notes, [item.id]: e.target.value })} />
            </label>
            <div className="continuity-actions">
              {item.kind === 'proposal'
                ? <button className="btn-primary" disabled={action.busy} onClick={() => void decide(item, 'approve')}>Approve</button>
                : <button className="btn-primary" disabled={action.busy} onClick={() => void decide(item, 'acknowledge')}>I have seen this</button>}
              <button className="btn-secondary" disabled={action.busy} onClick={() => void decide(item, 'dismiss')}>Dismiss</button>
            </div>
          </article>
        ))}
      </Panel>

      <Panel title="Recently decided">
        {!decided.length && <Empty>Nothing yet.</Empty>}
        {decided.map((item) => (
          <article key={item.id} className="continuity-item">
            <h3>{item.title} <Badge>{item.status === 'APPROVED' ? 'Approved' : item.status === 'DISMISSED' ? 'Dismissed' : 'Seen'}</Badge></h3>
            <p className="continuity-muted">{item.patientName} · {item.decidedBy ?? 'a doctor'} · {formatTime(item.decidedAt)}{item.decisionNote ? ` · “${item.decisionNote}”` : ''}</p>
          </article>
        ))}
      </Panel>

      <Panel title="What the assistant did">
        {!log.length && <Empty>It has not done anything yet.</Empty>}
        {!!log.length && (
          <div className="assistant-log-wrap">
            <table className="assistant-log">
              <thead>
                <tr><th scope="col">When</th><th scope="col">Patient</th><th scope="col">Work</th><th scope="col">Step</th><th scope="col">Result</th><th scope="col">Why</th></tr>
              </thead>
              <tbody>
                {log.map((row) => (
                  <tr key={row.id}>
                    <td>{formatTime(row.createdAt)}</td>
                    <td>{row.patientName}</td>
                    <td>{WORKFLOW_TEXT[row.workflow] ?? row.workflow}</td>
                    <td>{TOOL_TEXT[row.tool] ?? row.tool}</td>
                    <td>{OUTCOME_TEXT[row.status] ?? row.status}</td>
                    <td>{row.reason}{row.result && row.status === 'FAILED' ? ` ${row.result}` : ''}</td>
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
