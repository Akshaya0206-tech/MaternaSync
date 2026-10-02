import { useState } from 'react';
import { Send, CheckCircle2, Calendar, MessageSquare, Stethoscope, Upload, ArrowRight } from 'lucide-react';
import { StatusBadge } from '../StatusBadge';
import type { BadgeTone } from '../StatusBadge';

export interface ReferralDetailData {
  referral: {
    id: string;
    referenceCode: string | null;
    patientName: string;
    title: string;
    description: string;
    destination: string | null;
    referredTo: string | null;
    status: string;
    ownerName: string | null;
    waitingFor: string | null;
    waitingSince: string | null;
    sentAt: string | null;
    acknowledgedAt: string | null;
    appointmentDate: string | null;
    appointmentTime: string | null;
    externalProvider: string | null;
    responseReceivedAt: string | null;
    doctorReviewedAt: string | null;
    createdAt: string;
  };
  events: { id: string; fromStatus: string | null; toStatus: string; note: string | null; actorName: string | null; actorSource: string; createdAt: string }[];
  communications: { id: string; type: string; direction: string; senderLabel: string | null; recipientLabel: string | null; subject: string | null; content: string; createdAt: string; receivedAt: string | null }[];
  relatedTask: { title: string; status: string; waitingFor: string | null } | null;
  documents: { id: string; filename: string; status: string; statusLabel: string }[];
}

const STATUS_TONE: Record<string, BadgeTone> = {
  DRAFT: 'neutral', SENT: 'blue', ACKNOWLEDGED: 'purple', APPOINTMENT_SCHEDULED: 'amber',
  RESPONSE_RECEIVED: 'amber', CLOSED: 'green',
};
const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft', SENT: 'Sent', ACKNOWLEDGED: 'Acknowledged', APPOINTMENT_SCHEDULED: 'Appointment Scheduled',
  RESPONSE_RECEIVED: 'Response Received', CLOSED: 'Closed',
};
const STAGES = ['DRAFT', 'SENT', 'ACKNOWLEDGED', 'APPOINTMENT_SCHEDULED', 'RESPONSE_RECEIVED', 'CLOSED'];

function formatDateTime(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

interface CareTeamActions {
  onSend: () => Promise<void>;
  onAcknowledge: (note: string) => Promise<void>;
  onRecordAppointment: (date: string, time: string, provider: string) => Promise<void>;
  onRecordResponse: (text: string) => Promise<void>;
  onUploadDocument: (file: File, description: string) => Promise<void>;
}

interface DoctorActions {
  onClose: () => Promise<void>;
}

interface Props {
  data: ReferralDetailData;
  careTeamActions?: CareTeamActions;
  doctorActions?: DoctorActions;
  isActing?: boolean;
  error?: string | null;
}

export function ReferralDetailView({ data, careTeamActions, doctorActions, isActing, error }: Props) {
  const { referral, events, communications, relatedTask, documents } = data;
  const [ackNote, setAckNote] = useState('');
  const [apptDate, setApptDate] = useState('');
  const [apptTime, setApptTime] = useState('');
  const [apptProvider, setApptProvider] = useState('');
  const [responseText, setResponseText] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');

  const currentStageIndex = STAGES.indexOf(referral.status);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="glass-panel" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)' }}>{referral.referenceCode}</div>
            <div className="page-title" style={{ fontSize: '1.15rem' }}>{referral.title}</div>
          </div>
          <StatusBadge label={STATUS_LABEL[referral.status] ?? referral.status} tone={STATUS_TONE[referral.status] ?? 'neutral'} />
        </div>
        <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
          Patient: {referral.patientName} · Destination: {referral.destination ?? 'Not specified'} · Owner: {referral.ownerName ?? 'Unassigned'}
        </div>
        {referral.description && <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '6px' }}>{referral.description}</div>}

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '16px', flexWrap: 'wrap' }}>
          {STAGES.map((s, i) => (
            <span key={s} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{
                fontSize: '0.68rem', fontWeight: 700, padding: '3px 8px', borderRadius: 'var(--radius-full)',
                background: i <= currentStageIndex ? 'var(--mint-soft)' : 'var(--bg-tertiary)',
                color: i <= currentStageIndex ? 'var(--forest-dark)' : 'var(--text-muted)',
              }}>
                {STATUS_LABEL[s]}
              </span>
              {i < STAGES.length - 1 && <ArrowRight size={11} style={{ color: 'var(--text-muted)' }} />}
            </span>
          ))}
        </div>

        {referral.waitingFor && (
          <div style={{ marginTop: '14px', background: 'var(--peach-muted)', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: '0.82rem', color: 'var(--text-primary)' }}>
            <strong>Waiting for:</strong> {referral.waitingFor}
            {referral.waitingSince && <span style={{ color: 'var(--text-muted)' }}> · since {formatDateTime(referral.waitingSince)}</span>}
          </div>
        )}
      </div>

      {error && <div className="glass-panel" style={{ padding: '12px 18px', color: 'var(--rose-urgent)', fontSize: '0.84rem' }}>{error}</div>}

      {/* Actions */}
      {careTeamActions && referral.status === 'DRAFT' && (
        <ActionCard title="Send Referral">
          <button onClick={() => careTeamActions.onSend()} disabled={isActing} className="btn-primary"><Send size={14} /> Send Referral</button>
        </ActionCard>
      )}
      {careTeamActions && referral.status === 'SENT' && (
        <ActionCard title="Record Acknowledgement">
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 8px 0' }}>
            Use this only if you learned about the acknowledgement outside the External Hospital Simulator (e.g. a phone call).
          </p>
          <input value={ackNote} onChange={(e) => setAckNote(e.target.value)} placeholder="How was this acknowledged?" style={inputStyle} />
          <button onClick={() => careTeamActions.onAcknowledge(ackNote)} disabled={isActing} className="btn-secondary" style={{ marginTop: '10px' }}>
            <CheckCircle2 size={14} /> Record Acknowledgement
          </button>
        </ActionCard>
      )}
      {careTeamActions && referral.status === 'ACKNOWLEDGED' && (
        <ActionCard title="Record Appointment">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <input type="date" value={apptDate} onChange={(e) => setApptDate(e.target.value)} style={inputStyle} />
            <input type="time" value={apptTime} onChange={(e) => setApptTime(e.target.value)} style={inputStyle} />
          </div>
          <input value={apptProvider} onChange={(e) => setApptProvider(e.target.value)} placeholder="External provider (optional)" style={inputStyle} />
          <button onClick={() => careTeamActions.onRecordAppointment(apptDate, apptTime, apptProvider)} disabled={isActing || !apptDate} className="btn-secondary" style={{ marginTop: '10px' }}>
            <Calendar size={14} /> Record Appointment
          </button>
        </ActionCard>
      )}
      {careTeamActions && referral.status === 'APPOINTMENT_SCHEDULED' && (
        <ActionCard title="Record Response">
          <textarea value={responseText} onChange={(e) => setResponseText(e.target.value)} rows={3} placeholder="What did the external hospital respond with?" style={{ ...inputStyle, resize: 'vertical' }} />
          <button onClick={() => careTeamActions.onRecordResponse(responseText)} disabled={isActing || !responseText.trim()} className="btn-secondary" style={{ marginTop: '10px' }}>
            <MessageSquare size={14} /> Record Response
          </button>
        </ActionCard>
      )}
      {careTeamActions && referral.status === 'RESPONSE_RECEIVED' && (
        <ActionCard title="Attach Response Document">
          <input value={uploadDescription} onChange={(e) => setUploadDescription(e.target.value)} placeholder="e.g. MFM_Response.pdf summary" style={inputStyle} />
          <label className="btn-secondary" style={{ marginTop: '10px', display: 'inline-flex', cursor: 'pointer' }}>
            <Upload size={14} /> Choose File
            <input
              type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) careTeamActions.onUploadDocument(f, uploadDescription); }}
            />
          </label>
          <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '8px' }}>Optional — the doctor can review the response text alone if no document was provided.</p>
        </ActionCard>
      )}
      {doctorActions && referral.status === 'RESPONSE_RECEIVED' && (
        <ActionCard title="Doctor Review">
          <p style={{ fontSize: '0.82rem', color: 'var(--text-primary)', marginBottom: '10px' }}>{referral.description}</p>
          <button onClick={() => doctorActions.onClose()} disabled={isActing} className="btn-primary"><Stethoscope size={14} /> Mark Reviewed &amp; Close</button>
        </ActionCard>
      )}

      {/* Communication */}
      {communications.length > 0 && (
        <SectionCard title="Communication">
          {communications.map((c) => (
            <div key={c.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                {c.direction === 'OUTBOUND' ? 'Sent' : 'Received'} · {formatDateTime(c.createdAt)}
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', marginTop: '2px' }}>{c.subject}</div>
            </div>
          ))}
        </SectionCard>
      )}

      {/* Timeline */}
      <SectionCard title="Timeline">
        {events.map((e) => (
          <div key={e.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.82rem' }}>
            <strong style={{ color: 'var(--text-primary)' }}>{STATUS_LABEL[e.toStatus] ?? e.toStatus}</strong>
            <span style={{ color: 'var(--text-muted)' }}>
              {' '}· {formatDateTime(e.createdAt)} · {e.actorName ?? 'External Hospital Simulator'}
            </span>
            {e.note && <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>{e.note}</div>}
          </div>
        ))}
      </SectionCard>

      {/* Related Task */}
      {relatedTask && (
        <SectionCard title="Related Task">
          <div style={{ fontSize: '0.84rem', color: 'var(--text-primary)' }}>{relatedTask.title}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {relatedTask.status}{relatedTask.waitingFor && ` · Waiting for: ${relatedTask.waitingFor}`}
          </div>
        </SectionCard>
      )}

      {/* Documents */}
      {documents.length > 0 && (
        <SectionCard title="Documents">
          {documents.map((d) => (
            <div key={d.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.84rem', color: 'var(--text-primary)' }}>{d.filename}</span>
              <StatusBadge label={d.statusLabel} tone="amber" />
            </div>
          ))}
        </SectionCard>
      )}

      {/* External Response */}
      {referral.responseReceivedAt && (
        <SectionCard title="External Response">
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Received {formatDateTime(referral.responseReceivedAt)}</div>
        </SectionCard>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)',
  padding: '9px 11px', color: 'var(--text-primary)', fontSize: '0.84rem', fontFamily: 'inherit',
};

function ActionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-panel" style={{ padding: '18px 22px', border: '1px solid var(--emerald-raw-border)' }}>
      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--teal-primary)', textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: '10px' }}>{title}</div>
      {children}
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-panel" style={{ padding: '18px 22px' }}>
      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: '10px' }}>{title}</div>
      {children}
    </div>
  );
}
