import { useState, useEffect } from 'react';
import {
  apiFetch,
  getCsrfToken,
  getCurrentUser,
  setCsrfToken,
  setCurrentUser,
} from '../api';

export function useAuth() {
  const cachedUser = getCurrentUser();
  const hasCachedAuth = Boolean(cachedUser && getCsrfToken());
  const [ready, setReady] = useState(hasCachedAuth);
  const [user, setUser] = useState(cachedUser ?? null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (hasCachedAuth) return undefined;

    let cancelled = false;
    async function init() {
      try {
        const [csrfRes, meRes] = await Promise.all([
          apiFetch('/api/auth/csrf'),
          apiFetch('/api/auth/me'),
        ]);
        if (cancelled) return;
        setCsrfToken(csrfRes.csrfToken);
        setCurrentUser(meRes.user);
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
  }, [hasCachedAuth]);

  return { ready, user, error };
}
