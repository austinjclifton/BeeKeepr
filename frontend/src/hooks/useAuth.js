import { useState, useEffect } from 'react';
import { apiFetch, setCsrfToken } from '../api';

export function useAuth() {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const [csrfRes, meRes] = await Promise.all([
          apiFetch('/api/auth/csrf'),
          apiFetch('/api/auth/me'),
        ]);
        if (cancelled) return;
        setCsrfToken(csrfRes.csrfToken);
        setUser(meRes.user);
      } catch {
        if (cancelled) return;
        setError('unauthenticated');
      } finally {
        if (!cancelled) setReady(true);
      }
    }
    init();
    return () => { cancelled = true; };
  }, []);

  return { ready, user, error };
}