import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import {
  fetchReferralDetail, sendReferral, acknowledgeReferral, recordReferralAppointment,
  recordReferralResponse, uploadReferralDocument,
} from '../../api/careTeamPortal';
import type { ReferralDetail } from '../../api/careTeamPortal';
import { ApiError } from '../../api/client';
import { ReferralDetailView } from '../../components/shared/ReferralDetailView';

export function ReferralDetailPage() {
  const { referralId } = useParams<{ referralId: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<ReferralDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActing, setIsActing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = (id: string) => {
    setIsLoading(true);
    fetchReferralDetail(id)
      .then(setDetail)
      .catch(() => setLoadError("We couldn't load this referral. You may not be assigned to this patient."))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { if (referralId) load(referralId); }, [referralId]);

  if (!referralId) return null;

  const wrap = async (fn: () => Promise<unknown>) => {
    setIsActing(true);
    setActionError(null);
    try {
      await fn();
      load(referralId);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'That action could not be completed.');
    } finally {
      setIsActing(false);
    }
  };

  return (
    <main style={{ padding: '24px', flex: 1, maxWidth: '760px', margin: '0 auto', width: '100%' }}>
      <button onClick={() => navigate('/care-team/referrals')} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: 'var(--teal-primary)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, padding: 0, marginBottom: '14px' }}>
        <ArrowLeft size={15} /> Back to Referrals
      </button>

      {isLoading && <div className="glass-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>}
      {loadError && !isLoading && <div className="glass-panel" style={{ padding: '24px', color: 'var(--rose-urgent)', textAlign: 'center' }}>{loadError}</div>}

      {detail && !isLoading && (
        <ReferralDetailView
          data={detail}
          isActing={isActing}
          error={actionError}
          careTeamActions={{
            onSend: () => wrap(() => sendReferral(referralId)),
            onAcknowledge: (note) => wrap(() => acknowledgeReferral(referralId, note || undefined)),
            onRecordAppointment: (date, time, provider) => wrap(() => recordReferralAppointment(referralId, date, time || undefined, provider || undefined)),
            onRecordResponse: (text) => wrap(() => recordReferralResponse(referralId, text)),
            onUploadDocument: (file, description) => wrap(() => uploadReferralDocument(referralId, file, description)),
          }}
        />
      )}
    </main>
  );
}
