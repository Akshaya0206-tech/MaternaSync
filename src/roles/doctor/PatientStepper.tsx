import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../i18n';
import { useNeighbours } from './workspaceNav';

/** Previous and next patient, in the order My Patients last showed. The tab she was reading stays open when she moves on. */
export function PatientStepper({ episodeId, tab }: { episodeId: string; tab: string }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { previous, next } = useNeighbours(episodeId);
  if (!previous && !next) return null;
  const go = (id: string) => navigate(`/doctor/patients/${id}?tab=${tab}`);
  return (
    <nav className="workspace-stepper" aria-label={t('Move between your patients')}>
      {previous ? (
        <button type="button" className="btn-secondary" onClick={() => go(previous.id)}>
          <ChevronLeft size={15} aria-hidden="true" /> {t('Previous: {name}', { name: previous.name })}
        </button>
      ) : <span />}
      {next ? (
        <button type="button" className="btn-secondary" onClick={() => go(next.id)}>
          {t('Next: {name}', { name: next.name })} <ChevronRight size={15} aria-hidden="true" />
        </button>
      ) : <span />}
    </nav>
  );
}
