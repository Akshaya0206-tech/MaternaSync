import { Link, Outlet, useLocation } from 'react-router-dom';
import { AlarmClock, Bell, Calendar, ClipboardList, HeartPulse, Home, MessageCircle, PhoneCall, UserCircle } from 'lucide-react';
import { RoleSidebar } from '../../components/shared/RoleSidebar';
import { LanguageSwitcher } from '../../components/shared/LanguageSwitcher';
import { useAuth } from '../../auth/AuthContext';
import { LanguageProvider, useLanguage } from '../../i18n';
import { TextSizeControl } from '../../accessibility/TextSizeControl';
import { CaregiverProvider, useCaregiver } from './CaregiverContext';
import { CaregiverOfflineSync } from './CaregiverOfflineSync';
import { keptLinkToShow } from '../../offline/caregiverEmergencyCache';
import { useCaregiverUnread } from './useCaregiverUnread';

function CaregiverLayout() {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const { women, current, select, can, error } = useCaregiver();
  const { pathname } = useLocation();
  // Unread updates, in all and for each woman. The dot beside Updates follows the woman being looked at; the switcher shows each woman's own number.
  const unread = useCaregiverUnread(Boolean(user?.id), pathname);
  const newHere = current ? (unread.byLink[current.linkId] ?? 0) + unread.unassigned : unread.total;
  // With no signal the list of women may not load at all. The Emergency page still opens from the copy kept on this phone, so its button stays.
  // When the server HAS answered and she has not allowed it, the button stays hidden.
  const emergencyFromCopy = !current && women !== null && !women.length && Boolean(error) && keptLinkToShow() !== null;

  // Only the pages she has allowed appear in the menu. Home, Updates and Profile are always there.
  const navItems = [
    { label: t('Home'), to: '/caregiver/home', icon: <Home size={18} /> },
    ...(can('appointments') ? [{ label: t('Appointments'), to: '/caregiver/appointments', icon: <Calendar size={18} /> }] : []),
    ...(can('check_in') ? [{ label: t('Daily Check-in'), to: '/caregiver/check-in', icon: <HeartPulse size={18} /> }] : []),
    ...(can('care_plan') ? [{ label: t('Care plan'), to: '/caregiver/care-plan', icon: <ClipboardList size={18} /> }] : []),
    ...(can('reminders') ? [{ label: t('Reminders'), to: '/caregiver/reminders', icon: <AlarmClock size={18} /> }] : []),
    ...(can('questions') ? [{ label: t('Questions'), to: '/caregiver/questions', icon: <MessageCircle size={18} /> }] : []),
    { label: t('Updates'), to: '/caregiver/updates', icon: <Bell size={18} />, dot: newHere > 0 ? t('New updates') : undefined },
    { label: t('Profile'), to: '/caregiver/profile', icon: <UserCircle size={18} /> },
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
          can('emergency') || emergencyFromCopy
            ? <Link to="/caregiver/emergency" className="sidebar-emergency"><PhoneCall size={18} aria-hidden="true" /> {t('Emergency help')}</Link>
            : current && !current.ended && <Link to="/caregiver/home#talk" className="sidebar-emergency"><PhoneCall size={18} aria-hidden="true" /> {t('Talk to a person')}</Link>
        }
      />
      <div className="app-main-column" id="main-content" tabIndex={-1}>
        {current && (
          <div className="continuity-note caregiver-banner" role="status">
            {women && women.length > 1 ? (
              <span className="caregiver-switcher" role="group" aria-label={t('Who you are looking after')}>
                <span>{t('You are looking after')}</span>
                {women.map((w) => {
                  const count = unread.byLink[w.linkId] ?? 0;
                  return (
                    <button key={w.linkId} type="button" className={`caregiver-switch${w.linkId === current.linkId ? ' caregiver-switch-on' : ''}`} aria-pressed={w.linkId === current.linkId} onClick={() => select(w.linkId)}>
                      {w.womanName}
                      {count > 0 && <span className="caregiver-switch-count" aria-label={t('New updates: {count}', { count })}>{count}</span>}
                    </button>
                  );
                })}
              </span>
            ) : (
              <span>{t('You are looking after {name}.', { name: current.womanName })}</span>
            )}{' '}
            <span>{t('She chooses what you can see, and can change it at any time.')}</span>
          </div>
        )}
        <CaregiverOfflineSync />
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
