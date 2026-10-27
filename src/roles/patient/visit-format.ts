import type { BadgeTone } from '../../components/StatusBadge';
import { tx } from '../../i18n';

// The words a visit's status is shown in on her Appointments page: a visit she asked for is waiting, then confirmed or not going ahead.
// Her trusted person's Appointments page uses the same words (this file is shared so they cannot drift apart).
export const VISIT_STATUS: Record<string, string> = {
  requested: tx('Waiting for confirmation'),
  scheduled: tx('Confirmed'),
  completed: tx('Completed'),
  cancelled: tx('Not going ahead'),
  no_show: tx('Missed appointment'),
};
export const VISIT_STATUS_TONE: Record<string, BadgeTone> = {
  requested: 'amber',
  scheduled: 'blue',
  completed: 'green',
  cancelled: 'neutral',
  no_show: 'neutral',
};

/** The badge for one visit: a confirmed or requested visit whose time has gone by says so instead of looking current. `t` is the page's own translator. */
export function visitStatusOf(status: string, ahead: boolean, t: (text: string) => string): { label: string; tone: BadgeTone } {
  if (status === 'scheduled' && !ahead) return { label: t('The time has passed'), tone: 'neutral' };
  if (status === 'requested' && !ahead) return { label: t('The time you asked for has passed'), tone: 'neutral' };
  return { label: t(VISIT_STATUS[status] ?? status), tone: VISIT_STATUS_TONE[status] ?? 'neutral' };
}
