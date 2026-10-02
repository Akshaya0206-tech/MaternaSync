import { Outlet } from 'react-router-dom';
import { HeartPulse, FolderHeart, MessageCircle, Calendar, Bell, UserCircle } from 'lucide-react';
import { RoleSidebar } from '../../components/shared/RoleSidebar';
import { useAuth } from '../../auth/AuthContext';

const NAV_ITEMS = [
  { label: 'My Care', to: '/patient/dashboard', icon: <HeartPulse size={18} /> },
  { label: 'My Records', to: '/patient/records', icon: <FolderHeart size={18} /> },
  { label: 'My Questions', to: '/patient/questions', icon: <MessageCircle size={18} /> },
  { label: 'Appointments', to: '/patient/appointments', icon: <Calendar size={18} /> },
  { label: 'Updates', to: '/patient/updates', icon: <Bell size={18} /> },
  { label: 'Profile', to: '/patient/profile', icon: <UserCircle size={18} /> },
];

export function PatientShell() {
  const { user, logout } = useAuth();

  return (
    <div className="app-container">
      <RoleSidebar
        brandSubtitle="Your pregnancy journey, in one place"
        navItems={NAV_ITEMS}
        userName={user?.fullName ?? ''}
        roleLabel="Patient"
        onLogout={logout}
      />
      <div className="app-main-column">
        <Outlet />
      </div>
    </div>
  );
}
