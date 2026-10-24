import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, FileCheck2, Stethoscope, MessageCircle, FileText, ListTodo, ArrowRightLeft, Bell, UserCircle, BookOpen, SlidersHorizontal, Bot } from 'lucide-react';
import { RoleSidebar } from '../../components/shared/RoleSidebar';
import type { RoleNavItem } from '../../components/shared/RoleSidebar';
import { useAuth } from '../../auth/AuthContext';
import { assistantStatus } from '../../api/assistant';
import { TourProvider } from '../../tour/TourProvider';
import { TextSizeControl } from '../../accessibility/TextSizeControl';
import { doctorTourLabels, doctorTourSteps } from './tour';

const NAV_ITEMS: RoleNavItem[] = [
  { label: 'Dashboard', to: '/doctor/dashboard', icon: <LayoutDashboard size={18} /> },
  { label: 'My Patients', to: '/doctor/patients', icon: <Users size={18} /> },
  { label: "Today's Brief", to: '/doctor/todays-brief', icon: <FileCheck2 size={18} /> },
  { label: 'Consultations', to: '/doctor/consultations', icon: <Stethoscope size={18} /> },
  { label: 'Patient Questions', to: '/doctor/questions', icon: <MessageCircle size={18} /> },
  { label: 'Care Assistant', to: '/doctor/assistant', icon: <Bot size={18} /> },
  { label: 'Documentation', to: '/doctor/documentation', icon: <FileText size={18} /> },
  { label: 'Document Studio', to: '/doctor/draft-studio', icon: <FileText size={18} /> },
  { label: 'Connected Care', to: '/doctor/care-workspace', icon: <ListTodo size={18} /> },
  { label: 'Reference Library', to: '/doctor/library', icon: <FileCheck2 size={18} /> },
  { label: 'Clinical Settings', to: '/doctor/clinical-settings', icon: <SlidersHorizontal size={18} /> },
  { label: 'Clinic Overview', to: '/doctor/clinic', icon: <Users size={18} /> },
  { label: 'Follow-ups', to: '/doctor/follow-ups', icon: <ListTodo size={18} /> },
  { label: 'Guidelines', to: '/doctor/guidelines', icon: <BookOpen size={18} /> },
  { label: 'Handover', to: '/doctor/handover', icon: <ArrowRightLeft size={18} />, badge: 'Paused' },
  { label: 'Updates', to: '/doctor/updates', icon: <Bell size={18} /> },
  { label: 'Profile', to: '/doctor/profile', icon: <UserCircle size={18} /> },
];

export function DoctorShell() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  // How many things the care assistant is waiting on you for, shown beside "Care Assistant". Refreshed when you move between pages.
  const [waiting, setWaiting] = useState(0);
  useEffect(() => {
    let active = true;
    assistantStatus().then((s) => { if (active) setWaiting(s.open); }).catch(() => undefined);
    return () => { active = false; };
  }, [pathname]);
  const navItems = NAV_ITEMS.map((item) => (item.to === '/doctor/assistant' && waiting > 0 ? { ...item, badge: `${waiting} open` } : item));

  return (
    <TourProvider userId={user?.id ?? ''} steps={doctorTourSteps} labels={doctorTourLabels}>
      <div className="app-container">
        <RoleSidebar
          brandSubtitle="Clinical context and consultation documentation"
          navItems={navItems}
          userName={user?.fullName ?? ''}
          roleLabel="Doctor"
          onLogout={logout}
          footerExtra={<TextSizeControl />}
        />
        <div className="app-main-column" id="main-content" tabIndex={-1}>
          <Outlet />
        </div>
      </div>
    </TourProvider>
  );
}
