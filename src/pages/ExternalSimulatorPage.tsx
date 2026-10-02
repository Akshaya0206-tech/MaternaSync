import { useEffect, useState } from 'react';
import { AlertTriangle, Building2, CheckCircle2, Calendar, Send, ChevronLeft } from 'lucide-react';
import {
  fetchIncomingReferrals, acknowledgeReferral, scheduleAppointment, sendResponse,
} from '../api/externalSimulator';
import type { SimulatorReferral } from '../api/externalSimulator';

const STATUS_LABEL: Record<string, string> = {
  SENT: 'Sent', ACKNOWLEDGED: 'Acknowledged', APPOINTMENT_SCHEDULED: 'Appointment Scheduled',
  RESPONSE_RECEIVED: 'Response Received', CLOSED: 'Closed',
};

export function ExternalSimulatorPage() {
  const [referrals, setReferrals] = useState<SimulatorReferral[]>([]);
  const [selected, setSelected] = useState<SimulatorReferral | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActing, setIsActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apptDate, setApptDate] = useState('');
  const [apptTime, setApptTime] = useState('');
  const [apptProvider, setApptProvider] = useState('');
  const [responseText, setResponseText] = useState('');

  const load = () => {
    setIsLoading(true);
    fetchIncomingReferrals()
      .then(setReferrals)
      .catch(() => setError("Couldn't load incoming referrals."))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { load(); }, []);

  const refreshSelected = (code: string) => {
    load();
    fetchIncomingReferrals().then((list) => {
      const match = list.find((r) => r.referenceCode === code);
      if (match) setSelected(match);
    });
  };

  const handleAcknowledge = async () => {
    if (!selected) return;
    setIsActing(true);
    setError(null);
    try {
      const updated = await acknowledgeReferral(selected.referenceCode);
      setSelected(updated);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not acknowledge this referral.');
    } finally {
      setIsActing(false);
    }
  };

  const handleSchedule = async () => {
    if (!selected || !apptDate) return;
    setIsActing(true);
    setError(null);
    try {
      const updated = await scheduleAppointment(selected.referenceCode, apptDate, apptTime, apptProvider);
      setSelected(updated);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not schedule this appointment.');
    } finally {
      setIsActing(false);
    }
  };

  const handleSendResponse = async () => {
    if (!selected || !responseText.trim()) return;
    setIsActing(true);
    setError(null);
    try {
      const updated = await sendResponse(selected.referenceCode, responseText.trim());
      setSelected(updated);
      setResponseText('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send this response.');
    } finally {
      setIsActing(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#1a1a1a', padding: '24px', color: '#e5e5e5' }}>
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <Building2 size={22} style={{ color: '#f0a830' }} />
          <h1 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0 }}>External Hospital Simulator</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#3a2a10', border: '1px solid #f0a830', borderRadius: '8px', padding: '10px 14px', marginBottom: '22px', fontSize: '0.82rem' }}>
          <AlertTriangle size={16} style={{ color: '#f0a830', flexShrink: 0 }} />
          <span>
            <strong>Demo only.</strong> This is not a real hospital system. It stands in for an external
            hospital's referral inbox so the full MaternaSync referral workflow can be demonstrated without
            a real email/API/EHR integration. No login required — a real integration would use secure email, an API, or EHR connectivity instead.
          </span>
        </div>

        {selected ? (
          <div>
            <button onClick={() => setSelected(null)} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: '#f0a830', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, padding: 0, marginBottom: '14px' }}>
              <ChevronLeft size={15} /> Back to Incoming Referrals
            </button>

            <div style={{ background: '#242424', border: '1px solid #3a3a3a', borderRadius: '10px', padding: '20px', marginBottom: '16px' }}>
              <div style={{ fontSize: '0.74rem', color: '#999', marginBottom: '2px' }}>{selected.referenceCode}</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '4px' }}>{selected.patientName} — {selected.referralType}</div>
              <div style={{ fontSize: '0.82rem', color: '#aaa' }}>From: {selected.doctorName} · Status: {STATUS_LABEL[selected.status] ?? selected.status}</div>
              <pre style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '6px', padding: '14px', marginTop: '14px', fontSize: '0.78rem', whiteSpace: 'pre-wrap', color: '#ccc', fontFamily: 'monospace' }}>
                {selected.message}
              </pre>
            </div>

            {error && <div style={{ color: '#ff8080', fontSize: '0.82rem', marginBottom: '12px' }}>{error}</div>}

            {selected.status === 'SENT' && (
              <ActionBox title="Acknowledge Referral">
                <button onClick={handleAcknowledge} disabled={isActing} style={darkButtonStyle}><CheckCircle2 size={14} /> Acknowledge Referral</button>
              </ActionBox>
            )}

            {selected.status === 'ACKNOWLEDGED' && (
              <ActionBox title="Schedule Appointment">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <input type="date" value={apptDate} onChange={(e) => setApptDate(e.target.value)} style={darkInputStyle} />
                  <input type="time" value={apptTime} onChange={(e) => setApptTime(e.target.value)} style={darkInputStyle} />
                </div>
                <input value={apptProvider} onChange={(e) => setApptProvider(e.target.value)} placeholder="External provider name" style={darkInputStyle} />
                <button onClick={handleSchedule} disabled={isActing || !apptDate} style={{ ...darkButtonStyle, marginTop: '10px' }}><Calendar size={14} /> Send Appointment Update</button>
              </ActionBox>
            )}

            {selected.status === 'APPOINTMENT_SCHEDULED' && (
              <ActionBox title="Send Referral Response">
                <textarea
                  value={responseText} onChange={(e) => setResponseText(e.target.value)} rows={4}
                  placeholder="Referral consultation completed. Response document available."
                  style={{ ...darkInputStyle, resize: 'vertical' }}
                />
                <button onClick={handleSendResponse} disabled={isActing || !responseText.trim()} style={{ ...darkButtonStyle, marginTop: '10px' }}><Send size={14} /> Send Referral Response</button>
              </ActionBox>
            )}

            {(selected.status === 'RESPONSE_RECEIVED' || selected.status === 'CLOSED') && (
              <div style={{ fontSize: '0.82rem', color: '#999', textAlign: 'center', padding: '20px' }}>
                No further action available from this simulator — {selected.status === 'CLOSED' ? 'referral closed by the care team.' : 'awaiting MaternaSync review.'}
              </div>
            )}
          </div>
        ) : (
          <>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 12px 0', color: '#ccc' }}>Incoming Referrals</h2>
            {isLoading && <div style={{ color: '#999', fontSize: '0.84rem' }}>Loading…</div>}
            {error && !isLoading && <div style={{ color: '#ff8080', fontSize: '0.84rem' }}>{error}</div>}
            {!isLoading && !error && referrals.length === 0 && (
              <div style={{ color: '#999', fontSize: '0.84rem' }}>No referrals have been sent to this simulator yet.</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {referrals.map((r) => (
                <button
                  key={r.referenceCode}
                  onClick={() => { setSelected(r); refreshSelected(r.referenceCode); }}
                  style={{ ...darkCardStyle, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}
                >
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#999' }}>{r.referenceCode}</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>{r.patientName}</div>
                    <div style={{ fontSize: '0.8rem', color: '#aaa' }}>{r.referralType}</div>
                  </div>
                  <span style={{ fontSize: '0.74rem', fontWeight: 700, padding: '3px 10px', borderRadius: '999px', background: '#3a3a3a', color: '#f0a830' }}>
                    {STATUS_LABEL[r.status] ?? r.status}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const darkCardStyle: React.CSSProperties = {
  background: '#242424', border: '1px solid #3a3a3a', borderRadius: '10px', padding: '14px 18px', color: '#e5e5e5', font: 'inherit',
};

const darkButtonStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#f0a830', color: '#1a1a1a', fontWeight: 700,
  fontSize: '0.84rem', padding: '9px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
};

const darkInputStyle: React.CSSProperties = {
  width: '100%', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '6px', padding: '9px 11px',
  color: '#e5e5e5', fontSize: '0.84rem', fontFamily: 'inherit',
};

function ActionBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#242424', border: '1px solid #f0a830', borderRadius: '10px', padding: '18px' }}>
      <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#f0a830', textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: '10px' }}>{title}</div>
      {children}
    </div>
  );
}
