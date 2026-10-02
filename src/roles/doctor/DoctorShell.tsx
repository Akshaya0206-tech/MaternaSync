import { Outlet } from 'react-router-dom';
import { LayoutDashboard, Users, FileCheck2, Stethoscope, MessageCircle, FileText, ListTodo, ArrowRightLeft, Bell, UserCircle } from 'lucide-react';
import { RoleSidebar } from '../../components/shared/RoleSidebar';
import { useAuth } from '../../auth/AuthContext';

const NAV_ITEMS = [
  { label: 'Dashboard', to: '/doctor/dashboard', icon: <LayoutDashboard size={18} /> },
  { label: 'My Patients', to: '/doctor/patients', icon: <Users size={18} /> },
  { label: "Today's Brief", to: '/doctor/todays-brief', icon: <FileCheck2 size={18} /> },
  { label: 'Consultations', to: '/doctor/consultations', icon: <Stethoscope size={18} /> },
  { label: 'Patient Questions', to: '/doctor/questions', icon: <MessageCircle size={18} /> },
  { label: 'Documentation', to: '/doctor/documentation', icon: <FileText size={18} /> },
  { label: 'Follow-ups', to: '/doctor/follow-ups', icon: <ListTodo size={18} /> },
  { label: 'Handover', to: '/doctor/handover', icon: <ArrowRightLeft size={18} /> },
  { label: 'Updates', to: '/doctor/updates', icon: <Bell size={18} /> },
  { label: 'Profile', to: '/doctor/profile', icon: <UserCircle size={18} /> },
];

export function DoctorShell() {
  const { user, logout } = useAuth();

  return (
    <div className="app-container">
      <RoleSidebar
        brandSubtitle="Clinical context and consultation documentation"
        navItems={NAV_ITEMS}
        userName={user?.fullName ?? ''}
        roleLabel="Doctor"
        onLogout={logout}
      />
      <div className="app-main-column">
        <Outlet />
      </div>
    </div>
  );
}
