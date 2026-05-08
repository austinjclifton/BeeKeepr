import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiFetch, setCsrfToken, setCurrentUser } from '../api';

function ForgotPasswordModal({ onClose }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('idle');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiFetch('/api/auth/reset-password/request', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setStatus('success');
    } catch {
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 100, padding: '24px', animation: 'fadeIn 0.15s ease',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'white', borderRadius: '16px', padding: '32px',
        width: '100%', maxWidth: '400px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        animation: 'fadeIn 0.2s ease',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '17px', fontWeight: 800, color: '#1e2d4a' }}>Reset Password</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {status === 'success' ? (
          <div>
            <div style={{ padding: '14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', marginBottom: '20px', color: '#16a34a', fontSize: '14px', fontWeight: 500 }}>
              If an account exists for that email, a reset link has been sent.
            </div>
            <button
              onClick={onClose}
              style={{ width: '100%', padding: '10px', background: '#1e2d4a', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}
            >
              Back to Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px', lineHeight: 1.5 }}>
              Enter your email address and we'll send you a link to reset your password.
            </p>
            {status === 'error' && (
              <div style={{ marginBottom: '14px', padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626', fontSize: '13px' }}>
                Something went wrong. Please try again.
              </div>
            )}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '7px', fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="your@email.com"
                style={{
                  width: '100%', padding: '11px 14px',
                  border: '1.5px solid #e2e8f0', borderRadius: '10px',
                  fontSize: '14px', color: '#1e2d4a', background: '#f8fafc',
                  outline: 'none', fontFamily: 'inherit',
                }}
                onFocus={e => { e.target.style.borderColor = '#1e2d4a'; e.target.style.background = 'white'; }}
                onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#f8fafc'; }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" onClick={onClose} style={{ flex: 1, padding: '10px', border: '1.5px solid #e2e8f0', borderRadius: '10px', background: 'white', fontSize: '14px', fontWeight: 600, color: '#64748b', cursor: 'pointer' }}>
                Cancel
              </button>
              <button type="submit" disabled={loading} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '10px', background: loading ? '#94a3b8' : '#1e2d4a', color: 'white', fontSize: '14px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>
                {loading ? 'Sending…' : 'Send Reset Link'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: email, password }),
      });
      setCsrfToken(data.csrfToken);
      setCurrentUser(data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
      {showForgotPassword && <ForgotPasswordModal onClose={() => setShowForgotPassword(false)} />}

      <div style={{ width: '100%', maxWidth: '420px', animation: 'fadeIn 0.4s ease' }}>

        {/* Logo header */}
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

            {/* Sign-up prompt — new */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Don't have an account?{' '}
                <Link
                  to="/signup"
                  style={{ color: 'var(--amber)', fontWeight: 600, textDecoration: 'none' }}
                  onMouseEnter={e => e.target.style.opacity = '0.75'}
                  onMouseLeave={e => e.target.style.opacity = '1'}
                >
                  Sign up
                </Link>
              </div>
            </div>

            {/* Error */}
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
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            <form onSubmit={handleLogin}>

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
                    placeholder="admin@gmail.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    style={{
                      width: '100%', padding: '11px 14px 11px 40px',
                      border: '1.5px solid var(--border)', borderRadius: '10px',
                      fontSize: '14px', color: 'var(--text-primary)', background: '#f8fafc',
                      outline: 'none', transition: 'border-color 0.15s, background 0.15s',
                    }}
                    onFocus={e => { e.target.style.borderColor = 'var(--navy)'; e.target.style.background = 'white'; }}
                    onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.background = '#f8fafc'; }}
                  />
                </div>
              </div>

              {/* Password */}
              <div style={{ marginBottom: '20px' }}>
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
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    style={{
                      width: '100%', padding: '11px 14px 11px 40px',
                      border: '1.5px solid var(--border)', borderRadius: '10px',
                      fontSize: '14px', color: 'var(--text-primary)', background: '#f8fafc',
                      outline: 'none', transition: 'border-color 0.15s, background 0.15s',
                    }}
                    onFocus={e => { e.target.style.borderColor = 'var(--navy)'; e.target.style.background = 'white'; }}
                    onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.background = '#f8fafc'; }}
                  />
                </div>
              </div>

              {/* Remember + Forgot */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={e => setRemember(e.target.checked)}
                    style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: 'var(--navy)' }}
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  style={{
                    background: 'none', border: 'none', padding: 0,
                    fontSize: '13px', fontWeight: 600, color: 'var(--amber)',
                    cursor: 'pointer', transition: 'opacity 0.15s', fontFamily: 'inherit',
                  }}
                  onMouseEnter={e => e.target.style.opacity = '0.75'}
                  onMouseLeave={e => e.target.style.opacity = '1'}
                >
                  Forgot password?
                </button>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%', padding: '13px',
                  background: loading ? '#94a3b8' : 'var(--navy)',
                  color: 'white', border: 'none', borderRadius: '10px',
                  fontWeight: 700, fontSize: '14px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  transition: 'background 0.15s', letterSpacing: '0.01em',
                }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'var(--navy-light)'; }}
                onMouseLeave={e => { if (!loading) e.currentTarget.style.background = 'var(--navy)'; }}
              >
                {loading ? (
                  <>
                    <span style={{ animation: 'pulse 1s infinite', display: 'inline-block' }}>●</span>
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign In
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