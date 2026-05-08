import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiFetch, setCsrfToken, setCurrentUser } from '../api';

export default function SignUpPage() {
  const navigate = useNavigate();

  const [username, setUsername]           = useState('');
  const [email, setEmail]                 = useState('');
  const [password, setPassword]           = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError]                 = useState('');
  const [loading, setLoading]             = useState(false);

  function validate() {
    if (!username.trim())        return 'Username is required.';
    if (username.trim().length < 3) return 'Username must be at least 3 characters.';
    if (!email.trim())           return 'Email is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
                                 return 'Please enter a valid email address.';
    if (!password)               return 'Password is required.';
    if (password.length < 8)     return 'Password must be at least 8 characters.';
    if (password !== confirmPassword)
                                 return 'Passwords do not match.';
    return null;
  }

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError('');

    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setLoading(true);
    try {
      // POST /api/auth/register → { user, csrfToken }
      const data = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          username: username.trim(),
          email:    email.trim(),
          password,
        }),
      });
      setCsrfToken(data.csrfToken);
      setCurrentUser(data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /* ── Shared input focus/blur handlers ───────────────────────────── */

  const onFocus = (e) => {
    e.target.style.borderColor = 'var(--navy)';
    e.target.style.background  = 'white';
  };
  const onBlur = (e) => {
    e.target.style.borderColor = 'var(--border)';
    e.target.style.background  = '#f8fafc';
  };

  const inputStyle = {
    width: '100%',
    padding: '11px 14px 11px 40px',
    border: '1.5px solid var(--border)',
    borderRadius: '10px',
    fontSize: '14px',
    color: 'var(--text-primary)',
    background: '#f8fafc',
    outline: 'none',
    transition: 'border-color 0.15s, background 0.15s',
  };

  /* ── Render ──────────────────────────────────────────────────────── */

  return (
    <div style={{
      minHeight: '100vh',
      background: '#eef0f4',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>
      <div style={{ width: '100%', maxWidth: '420px', animation: 'fadeIn 0.4s ease' }}>

        {/* Logo header — identical to LoginPage */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div style={{
              width: '48px', height: '48px',
              background: 'var(--amber)',
              borderRadius: '14px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C8 2 5 5 5 9c0 2.5 1.2 4.7 3 6.1V20a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-4.9c1.8-1.4 3-3.6 3-6.1 0-4-3-7-7-7z" fill="white" opacity="0.95"/>
              </svg>
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--navy)', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                Asheville
              </div>
            </div>
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          boxShadow: '0 4px 24px rgba(30,45,74,0.10), 0 1px 4px rgba(30,45,74,0.06)',
          overflow: 'hidden',
        }}>
          {/* Top accent bar */}
          <div style={{ height: '4px', background: 'linear-gradient(90deg, var(--navy) 0%, var(--amber) 100%)' }} />

          <div style={{ padding: '36px 36px 32px' }}>
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--navy)', marginBottom: '4px' }}>
                Create your account
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Already have an account?{' '}
                <Link
                  to="/"
                  style={{ color: 'var(--amber)', fontWeight: 600, textDecoration: 'none' }}
                  onMouseEnter={e => e.target.style.opacity = '0.75'}
                  onMouseLeave={e => e.target.style.opacity = '1'}
                >
                  Sign in
                </Link>
              </div>
            </div>

            {/* Error banner */}
            {error && (
              <div style={{
                marginBottom: '20px',
                padding: '12px 14px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '10px',
                color: '#dc2626',
                fontSize: '13px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            <form onSubmit={handleSignUp} noValidate>

              {/* Username */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{
                  display: 'block', marginBottom: '7px',
                  fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)',
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                }}>
                  Username
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                  </span>
                  <input
                    type="text"
                    placeholder="e.g. beekeeper42"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    required
                    autoFocus
                    style={inputStyle}
                    onFocus={onFocus}
                    onBlur={onBlur}
                  />
                </div>
              </div>

              {/* Email */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{
                  display: 'block', marginBottom: '7px',
                  fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)',
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                }}>
                  Email Address
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                      <polyline points="22,6 12,13 2,6"/>
                    </svg>
                  </span>
                  <input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    style={inputStyle}
                    onFocus={onFocus}
                    onBlur={onBlur}
                  />
                </div>
              </div>

              {/* Password */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{
                  display: 'block', marginBottom: '7px',
                  fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)',
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  </span>
                  <input
                    type="password"
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    style={inputStyle}
                    onFocus={onFocus}
                    onBlur={onBlur}
                  />
                </div>
              </div>

              {/* Confirm Password */}
              <div style={{ marginBottom: '28px' }}>
                <label style={{
                  display: 'block', marginBottom: '7px',
                  fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)',
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                }}>
                  Confirm Password
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  </span>
                  <input
                    type="password"
                    placeholder="Repeat your password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                    style={{
                      ...inputStyle,
                      // Highlight mismatch once the user has typed something in both fields
                      borderColor: confirmPassword && password !== confirmPassword
                        ? '#fca5a5'
                        : 'var(--border)',
                    }}
                    onFocus={onFocus}
                    onBlur={onBlur}
                  />
                </div>
                {/* Inline mismatch hint — only shown while typing */}
                {confirmPassword && password !== confirmPassword && (
                  <div style={{ marginTop: '5px', fontSize: '12px', color: '#dc2626' }}>
                    Passwords do not match
                  </div>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '13px',
                  background: loading ? '#94a3b8' : 'var(--navy)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'background 0.15s',
                  letterSpacing: '0.01em',
                }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'var(--navy-light)'; }}
                onMouseLeave={e => { if (!loading) e.currentTarget.style.background = 'var(--navy)'; }}
              >
                {loading ? (
                  <>
                    <span style={{ animation: 'pulse 1s infinite', display: 'inline-block' }}>●</span>
                    Creating account…
                  </>
                ) : (
                  <>
                    Create Account
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                    </svg>
                  </>
                )}
              </button>

            </form>
          </div>

          {/* Footer */}
          <div style={{
            padding: '14px 36px',
            background: '#f8fafc',
            borderTop: '1px solid var(--border)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
              PROTECTED SYSTEM — UNAUTHORIZED ACCESS IS STRICTLY PROHIBITED
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}