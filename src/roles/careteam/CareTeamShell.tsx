import { Outlet } from 'react-router-dom';
import { LayoutDashboard, Users, FileCheck2, MessageCircle, ListTodo, Route, ArrowRightLeft, Bell, UserCircle } from 'lucide-react';
import { RoleSidebar } from '../../components/shared/RoleSidebar';
import { useAuth } from '../../auth/AuthContext';

const NAV_ITEMS = [
  { label: 'Dashboard', to: '/care-team/dashboard', icon: <LayoutDashboard size={18} /> },
  { label: 'Patients', to: '/care-team/patients', icon: <Users size={18} /> },
  { label: 'Documents', to: '/care-team/documents', icon: <FileCheck2 size={18} /> },
  { label: 'Patient Questions', to: '/care-team/questions', icon: <MessageCircle size={18} /> },
  { label: 'Tasks & Follow-ups', to: '/care-team/tasks', icon: <ListTodo size={18} /> },
  { label: 'Referrals', to: '/care-team/referrals', icon: <Route size={18} /> },
  { label: 'Handover', to: '/care-team/handover', icon: <ArrowRightLeft size={18} /> },
  { label: 'Updates', to: '/care-team/updates', icon: <Bell size={18} /> },
  { label: 'Profile', to: '/care-team/profile', icon: <UserCircle size={18} /> },
];

export function CareTeamShell() {
  const { user, logout } = useAuth();

  return (
    <div className="app-container">
      <RoleSidebar
        brandSubtitle="Coordinating care across your assigned patients"
        navItems={NAV_ITEMS}
        userName={user?.fullName ?? ''}
        roleLabel="Care Team"
        onLogout={logout}
      />
      <div className="app-main-column">
        <Outlet />
      </div>
    </div>
  );
}
