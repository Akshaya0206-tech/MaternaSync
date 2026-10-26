import { useLanguage } from '../../i18n';
import { sendOrKeepCheckIn } from '../../offline/pendingCheckIns';
import { GuidedCheckInForm } from './GuidedCheckInForm';
import { useCheckInSource } from './useCheckInSource';

/** The patient's step-by-step check-in. The form itself is shared with the trusted person's version (see GuidedCheckInForm). */
export function GuidedCheckInPage() {
  const { t } = useLanguage();
  const { workspace, userId, episodeId, offlineForm, canFill } = useCheckInSource();
  return (
    <GuidedCheckInForm
      ready={canFill}
      error={offlineForm ? '' : workspace.error}
      save={async (body) => {
        const result = await sendOrKeepCheckIn(userId, episodeId, body as unknown as Record<string, unknown>);
        if (result === 'queued') return t('No signal right now. Your check-in is kept on this phone and will be sent when you are back online.');
      }}
      subtitle={t('One question at a time. A health worker or a family member can help. The answers are saved as the patient’s own check-in.')}
      savedText={t('Your check-in was saved for your doctor.')}
      doneTo="/patient/daily-log"
      doneLabel={t('Back to the daily check-in')}
      draftKey={userId ? `maternasync.guided-draft.${userId}` : undefined}
    />
  );
}
