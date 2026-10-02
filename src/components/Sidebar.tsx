import { useState } from 'react';
import type { PhaseStage } from '../types/patient';
import {
  HeartPulse,
  FolderHeart,
  FileCheck2,
  Stethoscope,
  ListTodo,
  Route,
  MessageCircle,
  BarChart3,
  HelpCircle,
  Moon,
  Sun,
  Menu,
  X
} from 'lucide-react';

interface SidebarProps {
  currentPhase: PhaseStage;
  onSelectPhase: (phase: PhaseStage) => void;
  onSelectPatients: () => void;
  isPatientListActive: boolean;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onOpenSafetyModal: () => void;
  userName: string;
  userRole: string;
  onLogout: () => void;
}

interface NavItem {
  label: string;
  icon: React.ReactNode;
  phase?: PhaseStage;
  isPatients?: boolean;
  disabled?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPhase,
  onSelectPhase,
  onSelectPatients,
  isPatientListActive,
  theme,
  onToggleTheme,
  onOpenSafetyModal,
  userName,
  userRole,
  onLogout
}) => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const roleLabel = userRole.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
  const initials = userName.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('');

  const navItems: NavItem[] = [
    { label: 'Patients', icon: <FolderHeart size={18} />, isPatients: true },
    { label: "Today's Brief", icon: <FileCheck2 size={18} />, phase: 'phase2' },
    { label: 'Consultation', icon: <Stethoscope size={18} />, phase: 'consultation' },
    { label: 'Workflow Management', icon: <ListTodo size={18} />, phase: 'workflow' },
    { label: 'Continuity & Follow-Up', icon: <Route size={18} />, phase: 'continuity' },
    { label: 'Communications', icon: <MessageCircle size={18} />, disabled: true },
    { label: 'Reports', icon: <BarChart3 size={18} />, disabled: true }
  ];

  const handleSelect = (item: NavItem) => {
    if (item.disabled) return;
    if (item.isPatients) {
      onSelectPatients();
      setIsMobileOpen(false);
      return;
    }
    if (!item.phase) return;
    onSelectPhase(item.phase);
    setIsMobileOpen(false);
  };

  const isItemActive = (item: NavItem) => {
    if (item.isPatients) return isPatientListActive;
    if (!item.phase || isPatientListActive) return false;
    return currentPhase === item.phase;
  };

  return (
    <>
      <button
        className="sidebar-mobile-toggle"
        onClick={() => setIsMobileOpen(true)}
        style={{
          position: 'fixed',
          top: '14px',
          left: '14px',
          zIndex: 50,
          width: '38px',
          height: '38px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--sidebar-bg)',
          color: 'var(--cream-soft)',
          border: 'none',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: 'var(--shadow-md)'
        }}
        aria-label="Open navigation"
      >
        <Menu size={18} />
      </button>

      {isMobileOpen && (
        <div className="sidebar-backdrop" onClick={() => setIsMobileOpen(false)} />
      )}

      <aside className={`sidebar${isMobileOpen ? ' sidebar-open' : ''}`}>
        {/* Logo */}
        <div style={{ padding: '22px 20px 18px 20px', display: 'flex', alignItems: 'flex-start', gap: '10px', borderBottom: '1px solid var(--sidebar-border)' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--sidebar-active-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--forest-dark)',
              flexShrink: 0
            }}
          >
            <HeartPulse size={19} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h1 style={{ fontSize: '1.05rem', color: '#ffffff', margin: 0, fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
                MaternaSync
              </h1>
              <button
                onClick={() => setIsMobileOpen(false)}
                className="sidebar-mobile-toggle"
                style={{ background: 'none', border: 'none', color: 'var(--sidebar-text)', cursor: 'pointer' }}
                aria-label="Close navigation"
              >
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: '0.7rem', color: 'var(--sidebar-text)', margin: '3px 0 0 0', lineHeight: 1.35 }}>
              Clinician Context Aggregator &amp; Patient Journey Engine
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto' }}>
          {navItems.map((item) => {
            const active = isItemActive(item);
            return (
              <button
                key={item.label}
                onClick={() => handleSelect(item)}
                disabled={item.disabled}
                title={item.disabled ? `${item.label} — coming soon` : item.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  background: active ? 'var(--sidebar-active-bg)' : 'transparent',
                  color: active ? 'var(--sidebar-text-active)' : item.disabled ? 'rgba(243,238,229,0.35)' : 'var(--sidebar-text)',
                  fontSize: '0.85rem',
                  fontWeight: active ? 700 : 500,
                  cursor: item.disabled ? 'default' : 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.15s ease, color 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  if (!active && !item.disabled) e.currentTarget.style.background = 'rgba(243, 238, 229, 0.08)';
                }}
                onMouseLeave={(e) => {
                  if (!active && !item.disabled) e.currentTarget.style.background = 'transparent';
                }}
              >
                <span style={{ display: 'flex', flexShrink: 0 }}>{item.icon}</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                {item.disabled && (
                  <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'rgba(243,238,229,0.45)', border: '1px solid rgba(243,238,229,0.2)', borderRadius: 'var(--radius-full)', padding: '1px 6px', flexShrink: 0 }}>
                    SOON
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User profile menu */}
        <div style={{ padding: '10px 12px', borderTop: '1px solid var(--sidebar-border)', position: 'relative' }}>
          <button
            onClick={() => setIsUserMenuOpen(o => !o)}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '7px 8px', borderRadius: 'var(--radius-md)', border: 'none', background: isUserMenuOpen ? 'rgba(243, 238, 229, 0.08)' : 'transparent', cursor: 'pointer', textAlign: 'left' }}
          >
            <span style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--sidebar-active-bg)', color: 'var(--forest-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800, flexShrink: 0 }}>
              {initials || 'U'}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</span>
              <span style={{ display: 'block', fontSize: '0.68rem', color: 'rgba(243,238,229,0.55)' }}>{roleLabel}</span>
            </span>
          </button>

          {isUserMenuOpen && (
            <div style={{ position: 'absolute', bottom: 'calc(100% - 4px)', left: '12px', right: '12px', background: 'var(--sidebar-bg-elevated)', border: '1px solid var(--sidebar-border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden', zIndex: 10 }}>
              <button
                onClick={() => setIsUserMenuOpen(false)}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', background: 'transparent', border: 'none', color: 'var(--sidebar-text)', fontSize: '0.82rem', cursor: 'pointer' }}
              >
                My Profile
              </button>
              <button
                onClick={onLogout}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', background: 'transparent', border: 'none', borderTop: '1px solid var(--sidebar-border)', color: 'var(--terracotta)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Logout
              </button>
            </div>
          )}
        </div>

        {/* Bottom utilities */}
        <div style={{ padding: '12px', borderTop: '1px solid var(--sidebar-border)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <button
            onClick={onToggleTheme}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: 'var(--radius-md)', border: 'none', background: 'transparent', color: 'var(--sidebar-text)', fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer', textAlign: 'left' }}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            <span>Settings</span>
            <span style={{ marginLeft: 'auto', fontSize: '0.68rem', color: 'rgba(243,238,229,0.5)' }}>{theme === 'dark' ? 'Light' : 'Dark'} mode</span>
          </button>
          <button
            onClick={onOpenSafetyModal}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: 'var(--radius-md)', border: 'none', background: 'transparent', color: 'var(--sidebar-text)', fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer', textAlign: 'left' }}
          >
            <HelpCircle size={18} />
            <span>Help &amp; Safety Policy</span>
          </button>
        </div>
      </aside>
    </>
  );
};
