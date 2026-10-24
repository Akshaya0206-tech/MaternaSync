import { api } from '../../api/client';
import { ROOT } from '../../api/continuity';
import { useLanguage } from '../../i18n';
import { useWorkspace } from '../../components/continuity/shared';
import { GuidedCheckInForm } from './GuidedCheckInForm';

/** The patient's step-by-step check-in. The form itself is shared with the trusted person's version (see GuidedCheckInForm). */
export function GuidedCheckInPage() {
  const { t } = useLanguage();
  const workspace = useWorkspace();
  return (
    <GuidedCheckInForm
      ready={Boolean(workspace.data)}
      error={workspace.error}
      save={async (body) => { await api.post(`${ROOT}/episodes/${workspace.episodeId}/logs`, body); }}
      subtitle={t('One question at a time. A health worker or a family member can help. The answers are saved as the patient’s own check-in.')}
      savedText={t('Your check-in was saved for your care team.')}
      doneTo="/patient/daily-log"
      doneLabel={t('Back to the daily check-in')}
    />
  );
}
