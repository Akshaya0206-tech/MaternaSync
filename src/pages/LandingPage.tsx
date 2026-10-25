import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { HeartPulse, Users, Stethoscope, ArrowRight, Building2, UserRoundCheck } from 'lucide-react';
import { fetchAuthOptions } from '../api/auth';
import { LanguageSwitcher } from '../components/shared/LanguageSwitcher';
import { LanguageProvider, tx, useLanguage } from '../i18n';
import { loadAuthDictionary } from '../i18n/dictionaries';

const PATIENT = {
  key: 'patient',
  title: tx('Patient'),
  description: tx('Track your pregnancy journey, review your records, and ask your doctor questions.'),
  icon: <HeartPulse size={24} />,
};
const CAREGIVER = {
  key: 'caregiver',
  title: tx('Caregiver'),
  description: tx('Help someone you care about with her appointments, check-ins and questions, as far as she allows.'),
  icon: <UserRoundCheck size={24} />,
};
const CARE_TEAM = {
  key: 'care-team',
  title: tx('Care Team'),
  description: tx('Coordinate documents, questions, tasks, and referrals across your assigned patients.'),
  icon: <Users size={24} />,
};
const DOCTOR = {
  key: 'doctor',
  title: tx('Doctor'),
  description: tx("Review Today's Brief, document consultations, and approve clinical follow-ups."),
  icon: <Stethoscope size={24} />,
};

function Landing() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  // The care-team login can be switched off. Its card only appears when the server says it is on.
  const [careTeamOn, setCareTeamOn] = useState(false);
  useEffect(() => {
    let active = true;
    fetchAuthOptions().then((options) => { if (active) setCareTeamOn(options.careTeamEnabled); }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  const workspaces = [PATIENT, CAREGIVER, ...(careTeamOn ? [CARE_TEAM] : []), DOCTOR];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream-warm)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 24px 64px' }}>
      <div style={{ alignSelf: 'flex-end', marginBottom: '32px' }}>
        <LanguageSwitcher tone="page" />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
        <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'var(--forest-dark)', color: 'var(--mint-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <HeartPulse size={22} />
        </div>
        <span style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>MaternaSync</span>
      </div>
      <p style={{ fontSize: '1.05rem', textAlign: 'center', maxWidth: '560px', margin: '0 0 48px 0', color: 'var(--text-secondary)' }}>
        {t('Connected maternal care, from every document to every follow-up.')}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', maxWidth: '920px', width: '100%' }}>
        {workspaces.map((workspace) => (
          <button
            key={workspace.key}
            onClick={() => navigate('/signin')}
            className="glass-panel"
            style={{ padding: '28px', textAlign: 'left', cursor: 'pointer', font: 'inherit', display: 'flex', flexDirection: 'column', gap: '14px' }}
          >
            <span style={{ width: '46px', height: '46px', borderRadius: 'var(--radius-md)', background: 'var(--mint-soft)', color: 'var(--forest-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {workspace.icon}
            </span>
            <span className="page-title" style={{ fontSize: '1.1rem' }}>{t(workspace.title)}</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{t(workspace.description)}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 700, color: 'var(--teal-primary)', marginTop: 'auto' }}>
              {t('Continue')} <ArrowRight size={15} />
            </span>
          </button>
        ))}
      </div>

      <Link
        to="/external-simulator"
        style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '40px', fontSize: '0.8rem', color: 'var(--text-muted)', textDecoration: 'none' }}
      >
        <Building2 size={14} /> {t('External Hospital Simulator (Demo)')}
      </Link>
    </div>
  );
}

export function LandingPage() {
  return (
    <LanguageProvider variant="local" load={loadAuthDictionary}>
      <Landing />
    </LanguageProvider>
  );
}
