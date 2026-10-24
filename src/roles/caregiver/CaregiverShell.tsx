import { Link, Outlet } from 'react-router-dom';
import { Bell, Calendar, ClipboardList, HeartPulse, Home, Languages, MessageCircle, PhoneCall } from 'lucide-react';
import { RoleSidebar } from '../../components/shared/RoleSidebar';
import { useAuth } from '../../auth/AuthContext';
import { LanguageProvider, useLanguage } from '../../i18n';
import type { Language } from '../../i18n';
import { TextSizeControl } from '../../accessibility/TextSizeControl';
import { CaregiverProvider, useCaregiver } from './CaregiverContext';

const LANGUAGE_NAMES: Record<Language, string> = { en: 'English', hi: 'हिन्दी', ta: 'தமிழ்', te: 'తెలుగు' };

function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 8px 8px', color: 'var(--sidebar-text)', fontSize: '0.75rem' }}>
      <Languages size={16} aria-hidden="true" />
      <span style={{ flexShrink: 0 }}>{t('Language')}</span>
      <select
        value={language}
        onChange={(event) => void setLanguage(event.target.value as Language)}
        aria-label={t('Language')}
        style={{ flex: 1, minWidth: 0, padding: '5px 6px', borderRadius: 'var(--radius-md)', border: '1px solid var(--sidebar-border)', background: 'var(--sidebar-bg)', color: 'var(--cream-soft)', fontSize: '0.8rem' }}
      >
        {Object.entries(LANGUAGE_NAMES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select>
    </label>
  );
}

function CaregiverLayout() {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const { women, current, select, can } = useCaregiver();

  // Only the pages she has allowed appear in the menu. Home and Updates are always there.
  const navItems = [
    { label: t('Home'), to: '/caregiver/home', icon: <Home size={18} /> },
    ...(can('appointments') ? [{ label: t('Appointments'), to: '/caregiver/appointments', icon: <Calendar size={18} /> }] : []),
    ...(can('check_in') ? [{ label: t('Daily Check-in'), to: '/caregiver/check-in', icon: <HeartPulse size={18} /> }] : []),
    ...(can('care_plan') ? [{ label: t('Care plan'), to: '/caregiver/care-plan', icon: <ClipboardList size={18} /> }] : []),
    ...(can('questions') ? [{ label: t('Questions'), to: '/caregiver/questions', icon: <MessageCircle size={18} /> }] : []),
    { label: t('Updates'), to: '/caregiver/updates', icon: <Bell size={18} /> },
  ];

  return (
    <div className="app-container">
      <RoleSidebar
        brandSubtitle={t('Helping someone you care about')}
        navItems={navItems}
        userName={user?.fullName ?? ''}
        roleLabel={t('Trusted person')}
        onLogout={logout}
        logoutLabel={t('Logout')}
        skipLabel={t('Skip to main content')}
        footerExtra={
          <>
            <LanguageSwitcher />
            <TextSizeControl labels={{ title: t('Text size'), normal: t('Normal text'), large: t('Large text'), xlarge: t('Extra large text') }} />
          </>
        }
        topExtra={
          can('emergency')
            ? <Link to="/caregiver/emergency" className="sidebar-emergency"><PhoneCall size={18} aria-hidden="true" /> {t('Emergency help')}</Link>
            : current && <Link to="/caregiver/home#talk" className="sidebar-emergency"><PhoneCall size={18} aria-hidden="true" /> {t('Talk to a person')}</Link>
        }
      />
      <div className="app-main-column" id="main-content" tabIndex={-1}>
        {current && (
          <div className="continuity-note caregiver-banner" role="status">
            {women && women.length > 1 ? (
              <label>
                {t('You are looking after')}{' '}
                <select value={current.linkId} onChange={(e) => select(e.target.value)} aria-label={t('Who you are looking after')}>
                  {women.map((w) => <option key={w.linkId} value={w.linkId}>{w.womanName}</option>)}
                </select>
              </label>
            ) : (
              <span>{t('You are looking after {name}.', { name: current.womanName })}</span>
            )}{' '}
            <span>{t('She chooses what you can see, and can change it at any time.')}</span>
          </div>
        )}
        <Outlet />
      </div>
    </div>
  );
}

export function CaregiverShell() {
  return (
    <LanguageProvider variant="caregiver">
      <CaregiverProvider>
        <CaregiverLayout />
      </CaregiverProvider>
    </LanguageProvider>
  );
}
