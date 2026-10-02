import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchReferrals } from '../../api/careTeamPortal';
import type { Referral } from '../../api/careTeamPortal';
import { StatusBadge } from '../../components/StatusBadge';
import { REFERRAL_STATUS_TONE, friendlyReferralStatus, formatFriendlyDate } from './format';

export function ReferralsPage() {
  const navigate = useNavigate();
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchReferrals()
      .then(setReferrals)
      .catch(() => setError("We couldn't load referrals. Please try again."))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <main style={{ padding: '24px', flex: 1, maxWidth: '900px', margin: '0 auto', width: '100%' }}>
      <h1 className="page-title" style={{ fontSize: '1.4rem', margin: '0 0 6px 0' }}>Referrals</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', margin: '0 0 18px 0' }}>
        Referrals are created by the assigned doctor. Coordinate each one through to close here.
      </p>

      {isLoading && <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>}
      {error && !isLoading && <div className="glass-panel" style={{ padding: '24px', color: 'var(--rose-urgent)', textAlign: 'center' }}>{error}</div>}
      {!isLoading && !error && referrals.length === 0 && (
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>No referrals yet.</div>
      )}

      {!isLoading && !error && referrals.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {referrals.map((r) => (
            <button
              key={r.id}
              onClick={() => navigate(`/care-team/referrals/${r.id}`)}
              className="glass-panel"
              style={{ padding: '16px 20px', textAlign: 'left', cursor: 'pointer', font: 'inherit', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' }}
            >
              <div style={{ flex: 1, minWidth: '220px' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>{r.referenceCode} · {r.patientName}</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>{r.title}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Destination: {r.destination ?? 'Not specified'} · Owner: {r.ownerName ?? 'Unassigned'} · Created {formatFriendlyDate(r.createdAt)}
                </div>
                {r.waitingFor && (
                  <div style={{ fontSize: '0.76rem', color: 'var(--amber-pending)', marginTop: '2px', fontWeight: 600 }}>
                    Waiting for: {r.waitingFor}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <StatusBadge label={friendlyReferralStatus(r.status)} tone={REFERRAL_STATUS_TONE[r.status]} />
                <span className="btn-outline-emerald">Open</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </main>
  );
}
