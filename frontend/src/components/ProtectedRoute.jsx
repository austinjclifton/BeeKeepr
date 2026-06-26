import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  apiFetch,
  getCsrfToken,
  getCurrentUser,
  setCsrfToken,
  setCurrentUser,
} from '../api';

/* Guard authenticated pages */
export default function ProtectedRoute({ children }) {
  const hasCachedAuth = Boolean(getCurrentUser() && getCsrfToken());
  const [status, setStatus] = useState(hasCachedAuth ? 'ok' : 'loading');

  useEffect(() => {
    if (hasCachedAuth) return undefined;

    let cancelled = false;
    async function check() {
      try {
        const [csrfRes, meRes] = await Promise.all([
          apiFetch('/api/auth/csrf'),
          apiFetch('/api/auth/me'),
        ]);
        if (cancelled) return;
        setCsrfToken(csrfRes.csrfToken);
        setCurrentUser(meRes.user);
        setStatus('ok');
      } catch {
        if (!cancelled) setStatus('unauth');
      }
    }
    check();
    return () => { cancelled = true; };
  }, [hasCachedAuth]);

  /* Hold the route until auth resolves */
  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <div className="text-[14px] font-bold text-ink-secondary">Loading…</div>
      </div>
    );
  }

  /* Redirect expired sessions */
  if (status === 'unauth') {
    return <Navigate to="/" replace />;
  }

  return children;
}
