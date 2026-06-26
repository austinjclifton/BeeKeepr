import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  apiFetch,
  getCsrfToken,
  getCurrentUser,
  setCsrfToken,
  setCurrentUser,
} from '../api';
import beeLogo from '../assets/bee-logo.png';

const NAV_ITEMS = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    href: '/analytics',
    label: 'Analytics',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    href: '/alerts',
    label: 'Activity',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

function getSavedExpanded() {
  try { return localStorage.getItem('nav_expanded') !== 'false'; } catch { return true; }
}

function getInitials(name) {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(getSavedExpanded);
  const [user, setUser] = useState(() => getCurrentUser());
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  /* Close drawer on navigation */
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  /* Open drawer from page buttons */
  useEffect(() => {
    const handler = () => setMobileOpen(true);
    window.addEventListener('openMobileNav', handler);
    return () => window.removeEventListener('openMobileNav', handler);
  }, []);

  useEffect(() => {
    if (getCurrentUser() && getCsrfToken()) {
      setUser(getCurrentUser());
      return undefined;
    }

    async function initAuth() {
      try {
        const [csrfRes, meRes] = await Promise.all([
          apiFetch('/api/auth/csrf'),
          apiFetch('/api/auth/me'),
        ]);
        setCsrfToken(csrfRes.csrfToken);
        setCurrentUser(meRes.user);
        setUser(meRes.user);
      } catch {
        // Ignore expired sessions
      }
    }
    initAuth();
  }, []);

  const handleToggle = () => {
    setIsExpanded(prev => {
      const next = !prev;
      try { localStorage.setItem('nav_expanded', String(next)); } catch { }
      return next;
    });
  };

  const handleLogout = async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch (_) { }
    setCsrfToken(null);
    setCurrentUser(null);
    navigate('/');
  };

  const displayName = user?.username || 'User';
  const initials = getInitials(displayName);

  /* Force full mobile layout */
  const effectiveExpanded = isMobile ? true : isExpanded;

  return (
    <>
      {/* Mobile backdrop */}
      {isMobile && mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-[299] bg-black/55"
        />
      )}

      <aside
        className={
          'flex h-screen shrink-0 flex-col overflow-hidden ' +
          (isMobile
            ? `fixed top-0 z-[300] transition-[left] duration-300 ease-out ${mobileOpen ? 'left-0' : '-left-[260px]'}`
            : 'sticky top-0 transition-[width] duration-300 ease-out')
        }
        style={{
          width: isMobile ? '240px' : (isExpanded ? '240px' : '72px'),
          background: 'linear-gradient(180deg, #090909 0%, #050505 100%)',
          borderRight: '1px solid #2a2a2a',
          minHeight: '100vh',
        }}
      >
        {/* Brand and controls */}
        <div
          className={
            'flex items-center border-line border-b ' +
            (effectiveExpanded ? 'flex-row justify-between' : 'flex-col justify-center')
          }
          style={{
            padding: effectiveExpanded ? '28px 20px 24px' : '18px 10px 14px',
            gap: '12px',
            minHeight: effectiveExpanded ? '93px' : '116px',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[10px]"
            >
              <img src={beeLogo} alt="BeeKeepr logo" width="40" height="40" className="block object-cover" />
            </div>
            {effectiveExpanded && (
              <div>
                <div className="text-[18px] font-extrabold leading-[1.2] text-white">BeeKeepr</div>
                <div className="mt-[2px] text-[11px] text-ink-muted">Analytics</div>
              </div>
            )}
          </div>
          {!isMobile && (
            <button
              onClick={handleToggle}
              title={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-[10px] border border-line bg-white/[0.045] text-ink-muted transition hover:border-amber/45 hover:bg-amber/10 hover:text-white"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round">
                {isExpanded
                  ? <polyline points="15 18 9 12 15 6" />
                  : <polyline points="9 18 15 12 9 6" />
                }
              </svg>
            </button>
          )}
          {/* Mobile close */}
          {isMobile && (
            <button
              onClick={() => setMobileOpen(false)}
              className="flex cursor-pointer items-center justify-center border-none bg-transparent p-1 text-white/60"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Navigation items */}
        <nav className="flex flex-1 flex-col gap-[2px] py-3 px-2.5">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                title={!effectiveExpanded ? item.label : undefined}
                className={
                  'group/nav-link relative flex items-center gap-3 rounded-[10px] text-[14px] font-semibold transition-all duration-150 ' +
                  (effectiveExpanded ? 'px-3 py-2.5 justify-start' : 'px-0 py-2.5 justify-center') +
                  (isActive
                    ? ' border border-amber/22 bg-amber/12 font-extrabold text-white'
                    : ' border border-transparent text-ink-secondary hover:bg-white/[0.06] hover:text-white')
                }
                style={{ textDecoration: 'none' }}
              >
                {isActive && (
                  <span
                    className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-md"
                    style={{ background: '#f5a623' }}
                  />
                )}
                <span className={isActive ? 'shrink-0 text-amber' : 'shrink-0'}>{item.icon}</span>
                {effectiveExpanded && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="border-line border-t py-3 px-2.5">
          <div
            className={
              'flex items-center gap-2.5 rounded-[10px] p-2 ' +
              (effectiveExpanded ? 'justify-between' : 'justify-center')
            }
          >
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold text-navy"
                style={{ background: '#f5b942' }}
              >
                {initials}
              </div>
              {effectiveExpanded && (
                <div>
                  <div className="text-[13px] font-extrabold text-white">{displayName}</div>
                  <div className="text-[11px] text-ink-muted">{user?.email || 'Beekeeper'}</div>
                </div>
              )}
            </div>
            {effectiveExpanded && (
              <button
                onClick={handleLogout}
                title="Sign out"
                className="flex cursor-pointer items-center rounded-md border-none bg-transparent p-1 text-ink-muted transition hover:text-white/85"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
