import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Stethoscope, MessageCircle, ListTodo, ArrowRightLeft, Bell, UserCircle, BookOpen, SlidersHorizontal, Bot } from 'lucide-react';
import { RoleSidebar } from '../../components/shared/RoleSidebar';
import type { RoleNavItem } from '../../components/shared/RoleSidebar';
import { LanguageSwitcher } from '../../components/shared/LanguageSwitcher';
import { useAuth } from '../../auth/AuthContext';
import { assistantStatus } from '../../api/assistant';
import { LanguageProvider, tx, useLanguage } from '../../i18n';
import { loadDoctorDictionary } from '../../i18n/dictionaries';
import { TourProvider } from '../../tour/TourProvider';
import { TextSizeControl } from '../../accessibility/TextSizeControl';
import { doctorTourLabels, doctorTourSteps } from './tour';

// Menu names are marked here and translated where the menu is drawn.
const NAV_ITEMS: RoleNavItem[] = [
  { label: tx('Dashboard'), to: '/doctor/dashboard', icon: <LayoutDashboard size={18} /> },
  { label: tx('My Patients'), to: '/doctor/patients', icon: <Users size={18} /> },
  { label: tx('Consultations'), to: '/doctor/consultations', icon: <Stethoscope size={18} /> },
  { label: tx('Patient Questions'), to: '/doctor/questions', icon: <MessageCircle size={18} /> },
  { label: tx('Care Assistant'), to: '/doctor/assistant', icon: <Bot size={18} /> },
  // Document Studio is the second tab of this page; its old address still opens it, so this item stays highlighted there.
  { label: tx('Connected Care'), to: '/doctor/care-workspace', icon: <ListTodo size={18} />, alsoActiveOn: ['/doctor/draft-studio'] },
  { label: tx('References'), to: '/doctor/references', icon: <BookOpen size={18} /> },
  { label: tx('Clinical Settings'), to: '/doctor/clinical-settings', icon: <SlidersHorizontal size={18} /> },
  { label: tx('Clinic Overview'), to: '/doctor/clinic', icon: <Users size={18} /> },
  { label: tx('Follow-ups'), to: '/doctor/follow-ups', icon: <ListTodo size={18} /> },
  { label: tx('Handover'), to: '/doctor/handover', icon: <ArrowRightLeft size={18} />, badge: tx('Paused') },
  { label: tx('Updates'), to: '/doctor/updates', icon: <Bell size={18} /> },
  { label: tx('Profile'), to: '/doctor/profile', icon: <UserCircle size={18} /> },
];

function DoctorLayout() {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const { pathname } = useLocation();
  // How many things the care assistant is waiting on you for, shown beside "Care Assistant". Refreshed when you move between pages.
  const [waiting, setWaiting] = useState(0);
  useEffect(() => {
    let active = true;
    assistantStatus().then((s) => { if (active) setWaiting(s.open); }).catch(() => undefined);
    return () => { active = false; };
  }, [pathname]);
  const navItems = NAV_ITEMS.map((item) => ({
    ...item,
    label: t(item.label),
    // Just the number beside "Care Assistant": a word here squeezes a long translated menu name into broken lines.
    badge: item.to === '/doctor/assistant' && waiting > 0 ? String(waiting) : item.badge ? t(item.badge) : undefined,
  }));

  return (
    <TourProvider userId={user?.id ?? ''} steps={doctorTourSteps(t)} labels={doctorTourLabels(t)}>
      <div className="app-container">
        <RoleSidebar
          brandSubtitle={t('Clinical context and consultation documentation')}
          navItems={navItems}
          userName={user?.fullName ?? ''}
          roleLabel={t('Doctor')}
          onLogout={logout}
          logoutLabel={t('Logout')}
          skipLabel={t('Skip to main content')}
          footerExtra={
            <>
              <LanguageSwitcher />
              <TextSizeControl labels={{ title: t('Text size'), normal: t('Normal text'), large: t('Large text'), xlarge: t('Extra large text') }} />
            </>
          }
        />
        <div className="app-main-column" id="main-content" tabIndex={-1}>
          <Outlet />
        </div>
      </div>
    </TourProvider>
  );
}

export function DoctorShell() {
  return (
    <LanguageProvider variant="account" load={loadDoctorDictionary}>
      <DoctorLayout />
    </LanguageProvider>
  );
}
