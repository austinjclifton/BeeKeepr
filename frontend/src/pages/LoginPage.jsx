import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiFetch, setCsrfToken, setCurrentUser } from '../api';

const SHOW_DEMO_LOGIN = import.meta.env.VITE_SHOW_DEMO_LOGIN === 'true';
const DEMO_USERNAME = import.meta.env.VITE_DEMO_USERNAME || '';

const fieldLabelClass = 'mb-1.5 block text-[11px] font-bold uppercase tracking-[0.08em] text-ink-secondary';
const inputClass = 'w-full rounded-[10px] border border-line bg-white/[0.05] px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-ink-muted focus:border-amber focus:bg-white/[0.08]';
const primaryBtnClass = 'flex w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] border-none bg-amber px-3.5 py-3.5 text-sm font-bold text-navy transition hover:bg-amber-light disabled:cursor-not-allowed disabled:opacity-60';

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
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-6 animate-fade-in"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-[400px] rounded-lg border border-line bg-surface-elevated p-8 shadow-card-lg animate-fade-in"
      >
        <div className="mb-5 flex items-center justify-between">
          <div className="text-[17px] font-extrabold text-white">Reset Password</div>
          <button onClick={onClose} className="flex cursor-pointer items-center border-none bg-none text-[#94a3b8]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {status === 'success' ? (
          <div>
            <div className="mb-5 rounded-md border border-green-200 bg-green-50 p-3.5 text-sm font-medium text-green-700">
              If an account exists for that email, a reset link has been sent.
            </div>
            <button
              onClick={onClose}
              className="w-full cursor-pointer rounded-[10px] border-none bg-amber px-2.5 py-2.5 text-sm font-extrabold text-navy"
            >
              Back to Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <p className="mb-5 text-[13px] leading-[1.5] text-ink-secondary">
              Enter your email address and we'll send you a link to reset your password.
            </p>
            {status === 'error' && (
              <div className="mb-3.5 rounded-md border border-red-200 bg-red-50 p-2.5 text-[13px] text-red-700">
                Something went wrong. Please try again.
              </div>
            )}
            <div className="mb-5">
              <label className={fieldLabelClass}>
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="your@email.com"
                className={inputClass}
              />
            </div>
            <div className="flex gap-2.5">
              <button type="button" onClick={onClose} className="flex-1 cursor-pointer rounded-[10px] border border-line bg-white/[0.05] px-2.5 py-2.5 text-sm font-semibold text-ink-secondary">
                Cancel
              </button>
              <button type="submit" disabled={loading} className="flex-1 cursor-pointer rounded-[10px] border-none bg-amber px-2.5 py-2.5 text-sm font-extrabold text-navy disabled:cursor-not-allowed">
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
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const demoConfigured = SHOW_DEMO_LOGIN;

  const performLogin = async (identifier, loginPassword) => {
    setError('');
    setLoading(true);
    try {
      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password: loginPassword }),
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

  const handleLogin = async (e) => {
    e.preventDefault();
    await performLogin(identifier, password);
  };

  const loginWithDemoAccount = async () => {
    if (!demoConfigured) return;
    setError('');
    setLoading(true);
    try {
      const data = await apiFetch('/api/auth/demo-login', {
        method: 'POST',
      });
      setCsrfToken(data.csrfToken);
      setCurrentUser(data.user);
      setIdentifier(data.user?.username || DEMO_USERNAME || '');
      setPassword('');
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Demo login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-bg p-6 font-sans"
      style={{ background: 'radial-gradient(circle at top right, rgba(245,185,66,0.12), transparent 30rem), #050505' }}
    >
      {showForgotPassword && <ForgotPasswordModal onClose={() => setShowForgotPassword(false)} />}

      <div className="w-full max-w-[420px] animate-fade-in">

        {/* Brand header */}
        <div className="mb-8 text-center">
          <div className="mb-2 inline-flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-amber"
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C8 2 5 5 5 9c0 2.5 1.2 4.7 3 6.1V20a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-4.9c1.8-1.4 3-3.6 3-6.1 0-4-3-7-7-7z" fill="white" opacity="0.95" />
              </svg>
            </div>
            <div className="text-left">
              <div className="text-[28px] font-extrabold leading-[1.1] tracking-[-0.02em] text-white">
                BeeKeepr
              </div>
            </div>
          </div>
        </div>

        {/* Login card */}
        <div className="overflow-hidden rounded-lg border border-line bg-surface-elevated shadow-card-lg">
          {/* Accent bar */}
          <div className="h-1" style={{ background: 'linear-gradient(90deg, #050505 0%, #f5b942 100%)' }} />

          <div className="px-9 pt-9 pb-8">

            {/* Sign-up link */}
            <div className="mb-6">
              <div className="text-[13px] text-ink-muted">
                Don't have an account?{' '}
                <Link
                  to="/signup"
                  className="font-semibold text-amber transition hover:opacity-75"
                  style={{ textDecoration: 'none' }}
                >
                  Sign up
                </Link>
              </div>
            </div>

            {/* Demo access */}
            {SHOW_DEMO_LOGIN && (
              <div
                className="mb-[22px] rounded-md border border-amber/35 bg-amber/10 p-3.5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-[12px] font-black uppercase tracking-[0.08em] text-amber">
                      Demo Account
                    </div>
                    <div className="mt-1 text-[13px] leading-[1.5] text-ink-secondary">
                      Use the read-only demo account to explore BeeKeepr with sample hive data.
                    </div>
                  </div>
                  {demoConfigured && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={loginWithDemoAccount}
                        className="cursor-pointer rounded-pill border-none bg-amber px-3.5 py-2.5 text-[12px] font-black text-navy disabled:cursor-not-allowed disabled:opacity-55"
                        disabled={loading}
                      >
                        Log in demo
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Error banner */}
            {error && (
              <div className="mb-5 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-[13px] font-medium text-red-700">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {error}
              </div>
            )}

            <form onSubmit={handleLogin}>

              {/* Identifier */}
              <div className="mb-[18px]">
                <label className={fieldLabelClass}>
                  Email or Username
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    autoComplete="username"
                    placeholder="beekeeper@example.com or beekeeper123"
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                    required
                    className={`${inputClass} pl-10`}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="mb-5">
                <label className={fieldLabelClass}>
                  Password
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </span>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    className={`${inputClass} pl-10`}
                  />
                </div>
              </div>

              {/* Account options */}
              <div className="mb-6 flex items-center justify-between">
                <label className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-ink-secondary">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={e => setRemember(e.target.checked)}
                    className="h-[15px] w-[15px] cursor-pointer"
                    style={{ accentColor: '#050505' }}
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="cursor-pointer border-none bg-transparent p-0 text-[13px] font-semibold text-amber transition hover:opacity-75"
                >
                  Forgot password?
                </button>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className={primaryBtnClass}
              >
                {loading ? (
                  <>
                    <span className="inline-block animate-pulse">●</span>
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign In
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                    </svg>
                  </>
                )}
              </button>

            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
