import { caregiverCarePlan } from '../../api/caregiver';
import type { Workspace } from '../../api/continuity';
import { useLanguage } from '../../i18n';
import { Feedback, Page, Panel } from '../../components/continuity/shared';
import { SummaryList } from '../patient/SupportPages';
import { useCaregiver } from './CaregiverContext';
import { Needs } from './CaregiverGuards';
import { CaregiverSummaryActions } from './CaregiverSummaryActions';
import { useForWoman } from './useForWoman';

// ---------------------------------------------------------------- Care plan
export function CaregiverCarePlanPage() {
  const { t } = useLanguage();
  return (
    <Needs permission="care_plan" title={t('Care plan')}>
      {() => <CarePlan />}
    </Needs>
  );
}
function CarePlan() {
  const { t } = useLanguage();
  const { can } = useCaregiver();
  const plan = useForWoman<Workspace['outputs']>(caregiverCarePlan);
  return (
    <Page title={t('Care plan')} subtitle={t('Only what her doctor has approved and released to her.')}>
      <Feedback error={plan.error} />
      <Panel title={t('Approved summaries & instructions')}>
        {plan.loading && <p role="status" className="continuity-muted">{t('Loading…')}</p>}
        {plan.data && <SummaryList data={{ outputs: plan.data, appointments: [] }} renderActions={(output) => <CaregiverSummaryActions output={output} canAsk={can('questions')} />} />}
      </Panel>
    </Page>
  );
}
