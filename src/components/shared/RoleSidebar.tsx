import { useState } from 'react';
import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { HeartPulse, LogOut, Menu, X } from 'lucide-react';

export interface RoleNavItem {
  label: string;
  to: string;
  icon: ReactNode;
}

interface RoleSidebarProps {
  brandSubtitle: string;
  navItems: RoleNavItem[];
  userName: string;
  roleLabel: string;
  onLogout: () => void;
}

/** Navigation shell shared by all three role workspaces. Active-state and
 * navigation are driven entirely by the URL (NavLink), not local state —
 * this is what makes browser back/forward and direct URL entry work for
 * free, unlike the old phase-based Sidebar it's modeled on. */
export function RoleSidebar({ brandSubtitle, navItems, userName, roleLabel, onLogout }: RoleSidebarProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const initials = userName.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');

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
          boxShadow: 'var(--shadow-md)',
        }}
        aria-label="Open navigation"
      >
        <Menu size={18} />
      </button>

      {isMobileOpen && <div className="sidebar-backdrop" onClick={() => setIsMobileOpen(false)} />}

      <aside className={`sidebar${isMobileOpen ? ' sidebar-open' : ''}`}>
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
              flexShrink: 0,
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
              {brandSubtitle}
            </p>
          </div>
        </div>

        <nav style={{ flex: 1, padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto' }}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setIsMobileOpen(false)}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '9px 12px',
                borderRadius: 'var(--radius-md)',
                textDecoration: 'none',
                background: isActive ? 'var(--sidebar-active-bg)' : 'transparent',
                color: isActive ? 'var(--sidebar-text-active)' : 'var(--sidebar-text)',
                fontSize: '0.85rem',
                fontWeight: isActive ? 700 : 500,
                transition: 'background 0.15s ease, color 0.15s ease',
              })}
            >
              <span style={{ display: 'flex', flexShrink: 0 }}>{item.icon}</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: '10px 12px', borderTop: '1px solid var(--sidebar-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 8px' }}>
            <span style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--sidebar-active-bg)', color: 'var(--forest-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800, flexShrink: 0 }}>
              {initials || 'U'}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</span>
              <span style={{ display: 'block', fontSize: '0.68rem', color: 'rgba(243,238,229,0.55)' }}>{roleLabel}</span>
            </span>
          </div>
          <button
            onClick={onLogout}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '9px 12px', marginTop: '4px', borderRadius: 'var(--radius-md)', border: 'none', background: 'transparent', color: 'var(--terracotta)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}
