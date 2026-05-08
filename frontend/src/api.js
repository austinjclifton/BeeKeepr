let csrfToken = null;
let _currentUser = null;

export function setCsrfToken(token) {
  csrfToken = token;
}

export function setCurrentUser(user) {
  _currentUser = user;
}

export function getCurrentUser() {
  return _currentUser;
}

export async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (csrfToken && options.method && options.method !== 'GET') {
    headers['X-CSRF-Token'] = csrfToken;
  }
  const res = await fetch(path, { ...options, headers, credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.message || res.statusText);
  }
  return res.json();
}


export function cToF(c) {
  if (c == null) return null;
  return parseFloat(parseFloat(c).toFixed(1)); 
}