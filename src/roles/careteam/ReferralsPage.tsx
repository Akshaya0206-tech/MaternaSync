import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { fetchReferrals, updateReferral } from '../../api/careTeamPortal';
import type { Referral } from '../../api/careTeamPortal';
import { StatusBadge } from '../../components/StatusBadge';
import { REFERRAL_STATUS_TONE, friendlyReferralStatus, formatFriendlyDate } from './format';
import { AddReferralModal } from './AddReferralModal';

const STATUS_OPTIONS: Referral['status'][] = ['DRAFT', 'SENT', 'ACKNOWLEDGED', 'APPOINTMENT_SCHEDULED', 'RESPONSE_RECEIVED', 'CLOSED'];

const NEXT_ACTION: Record<Referral['status'], string> = {
  DRAFT: 'Send the referral',
  SENT: 'Awaiting acknowledgement',
  ACKNOWLEDGED: 'Awaiting appointment',
  APPOINTMENT_SCHEDULED: 'Awaiting visit',
  RESPONSE_RECEIVED: 'Share with doctor',
  CLOSED: 'None',
};

export function ReferralsPage() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const load = () => {
    setIsLoading(true);
    fetchReferrals()
      .then(setReferrals)
      .catch(() => setError("We couldn't load referrals. Please try again."))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleStatusChange = async (referralId: string, status: string) => {
    setReferrals((prev) => prev.map((r) => (r.id === referralId ? { ...r, status: status as Referral['status'] } : r)));
    try {
      await updateReferral(referralId, { status });
    } catch {
      load();
    }
  };

  return (
    <main style={{ padding: '24px', flex: 1, maxWidth: '900px', margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
        <h1 className="page-title" style={{ fontSize: '1.4rem', margin: 0 }}>Referrals</h1>
        <button onClick={() => setIsAddOpen(true)} className="btn-primary"><Plus size={15} /> Add Referral</button>
      </div>

      {isLoading && <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>}
      {error && !isLoading && <div className="glass-panel" style={{ padding: '24px', color: 'var(--rose-urgent)', textAlign: 'center' }}>{error}</div>}
      {!isLoading && !error && referrals.length === 0 && (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>No referrals yet.</div>
      )}

      {!isLoading && !error && referrals.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {referrals.map((r) => (
            <div key={r.id} className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>{r.patientName}</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>{r.title}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {r.referredTo ?? 'Not specified'} · Owner: {r.ownerName ?? 'Unassigned'} · Created {formatFriendlyDate(r.createdAt)}
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--teal-primary)', marginTop: '2px', fontWeight: 600 }}>Next: {NEXT_ACTION[r.status]}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <StatusBadge label={friendlyReferralStatus(r.status)} tone={REFERRAL_STATUS_TONE[r.status]} />
                <select
                  value={r.status}
                  onChange={(e) => handleStatusChange(r.id, e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.78rem', cursor: 'pointer' }}
                >
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{friendlyReferralStatus(s)}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}

      {isAddOpen && <AddReferralModal onClose={() => setIsAddOpen(false)} onCreated={() => { setIsAddOpen(false); load(); }} />}
    </main>
  );
}
