import { useEffect, useState } from 'react';
import { assistantSummary } from '../../api/assistant';
import type { AssistantSummary } from '../../api/assistant';
import { Panel } from '../../components/continuity/shared';
import { useLanguage } from '../../i18n';

/** Plain counts for the doctor's own patients, worked out by code on the server: what arrived, what was handled, how long it waited. */
export function AssistantCounts({ refresh }: { refresh: number }) {
  const { t } = useLanguage();
  const [data, setData] = useState<AssistantSummary | null>(null);

  useEffect(() => {
    assistantSummary(7).then(setData).catch(() => setData(null));
  }, [refresh]);

  if (!data) return null;
  const hours = (value: number | null) => (value === null ? t('Not enough yet') : String(value));
  const rows: [string, string | number][] = [
    [t('Questions received'), data.questions.received],
    [t('Questions answered'), data.questions.answered],
    [t('Typical hours to a reply'), hours(data.questions.hoursToReply)],
    [t('Documents uploaded'), data.documents.uploaded],
    [t('Documents verified'), data.documents.verified],
    [t('Typical hours to verify'), hours(data.documents.hoursToVerify)],
    [t('Check-ins recorded'), data.checkIns.recorded],
    [t('Patients whose agreed check-in is overdue'), data.checkIns.patientsOverdue],
    [t('Open tasks'), data.tasks.open],
    [t('Overdue tasks'), data.tasks.overdue],
    [t('Visit requests waiting for an answer'), data.visits.waitingForAnswer],
    [t('Visits completed'), data.visits.completed],
    [t('Visits recorded as missed'), data.visits.missed],
    [t('Steps the assistant did'), data.assistant.stepsDone],
    [t('Proposals you approved'), data.assistant.approved],
    [t('Proposals you dismissed'), data.assistant.dismissed],
    [t('Steps you undid'), data.assistant.undone],
  ];
  return (
    <Panel title={t('The last {days} days', { days: data.days })}>
      <p className="continuity-muted">{t("Plain counts worked out by code from your own patients' records. They are not scores or grades.")} ({data.from} – {data.to})</p>
      <dl className="assistant-status assistant-counts">
        {rows.map(([label, value]) => (
          <div key={label} className="assistant-count">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}
