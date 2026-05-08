import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { apiFetch, setCsrfToken } from '../api';

/**
 * ProtectedRoute — wraps any authenticated page.
 * If the session cookie is invalid/expired, redirects to login.
 */
export default function ProtectedRoute({ children }) {
  const [status, setStatus] = useState('loading'); // 'loading' | 'ok' | 'unauth'

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const [csrfRes] = await Promise.all([
          apiFetch('/api/auth/csrf'),
          apiFetch('/api/auth/me'),
        ]);
        if (cancelled) return;
        setCsrfToken(csrfRes.csrfToken);
        setStatus('ok');
      } catch {
        if (!cancelled) setStatus('unauth');
      }
    }
    check();
    return () => { cancelled = true; };
  }, []);

  if (status === 'loading') {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#f0f2f5',
      }}>
        <div style={{ color: '#94a3b8', fontSize: '14px', fontWeight: 500 }}>Loading…</div>
      </div>
    );
  }

  if (status === 'unauth') {
    return <Navigate to="/" replace />;
  }

  return children;
}