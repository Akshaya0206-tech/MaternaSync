import { Outlet } from 'react-router-dom';
import { HeartPulse, FolderHeart, MessageCircle, Calendar, Bell, UserCircle, Languages } from 'lucide-react';
import { RoleSidebar } from '../../components/shared/RoleSidebar';
import { useAuth } from '../../auth/AuthContext';
import { LanguageProvider, useLanguage } from '../../i18n';
import type { Language } from '../../i18n';

const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  hi: 'हिन्दी',
  ta: 'தமிழ்',
  te: 'తెలుగు',
};

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
        {Object.entries(LANGUAGE_NAMES).map(([key, label]) => (
          <option key={key} value={key}>{label}</option>
        ))}
      </select>
    </label>
  );
}

function PatientLayout() {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const navItems = [
    { label: t('My Care'), to: '/patient/dashboard', icon: <HeartPulse size={18} /> },
    { label: t('Daily Check-in'), to: '/patient/daily-log', icon: <HeartPulse size={18} /> },
    { label: t('My Care Plan'), to: '/patient/care-plan', icon: <Calendar size={18} /> },
    { label: t('Care Companion'), to: '/patient/companion', icon: <MessageCircle size={18} /> },
    { label: t('Sharing & Consent'), to: '/patient/consent', icon: <UserCircle size={18} /> },
    { label: t('My Records'), to: '/patient/records', icon: <FolderHeart size={18} /> },
    { label: t('My Questions'), to: '/patient/questions', icon: <MessageCircle size={18} /> },
    { label: t('Appointments'), to: '/patient/appointments', icon: <Calendar size={18} /> },
    { label: t('Updates'), to: '/patient/updates', icon: <Bell size={18} /> },
    { label: t('Profile'), to: '/patient/profile', icon: <UserCircle size={18} /> },
  ];

  return (
    <div className="app-container">
      <RoleSidebar
        brandSubtitle={t('Your pregnancy journey, in one place')}
        navItems={navItems}
        userName={user?.fullName ?? ''}
        roleLabel={t('Patient')}
        onLogout={logout}
        logoutLabel={t('Logout')}
        footerExtra={<LanguageSwitcher />}
      />
      <div className="app-main-column">
        <Outlet />
      </div>
    </div>
  );
}

export function PatientShell() {
  return (
    <LanguageProvider>
      <PatientLayout />
    </LanguageProvider>
  );
}
