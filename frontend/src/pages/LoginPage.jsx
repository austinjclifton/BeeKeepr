import { useEffect, useState } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { apiFetch, setCsrfToken, setCurrentUser } from '../api';
import { useAuth } from '../hooks/useAuth';

const SHOW_DEMO_LOGIN = import.meta.env.VITE_SHOW_DEMO_LOGIN === 'true';

const fieldLabelClass =
  'mb-2 block text-[11px] font-bold uppercase tracking-[0.08em] text-ink-secondary';

const inputClass =
  'h-12 w-full rounded-xl border border-white/10 bg-white/[0.045] px-3.5 text-sm text-white outline-none transition placeholder:text-ink-muted hover:border-white/15 focus:border-amber focus:bg-white/[0.07] focus:ring-2 focus:ring-amber/15';

const primaryBtnClass =
  'flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-none bg-amber px-4 text-sm font-extrabold text-navy transition hover:bg-amber-light focus:outline-none focus:ring-2 focus:ring-amber/30 focus:ring-offset-2 focus:ring-offset-[#050505] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60 disabled:active:translate-y-0';

const secondaryBtnClass =
  'flex h-11 cursor-pointer items-center justify-center rounded-xl border border-white/10 bg-white/[0.045] px-4 text-sm font-semibold text-ink-secondary transition hover:border-white/15 hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-60';

function BrandMark({ size = 'lg' }) {
  const boxClass =
    size === 'sm'
      ? 'h-10 w-10 rounded-[14px]'
      : 'h-12 w-12 rounded-[16px]';

  const svgSize = size === 'sm' ? 23 : 26;

  return (
    <div
      className={`flex ${boxClass} items-center justify-center bg-amber shadow-[0_0_32px_rgba(245,185,66,0.18)]`}
      aria-hidden="true"
    >
      <svg width={svgSize} height={svgSize} viewBox="0 0 24 24" fill="none">
        <path
          d="M8 4.5h8l4 7-4 7H8l-4-7 4-7Z"
          stroke="#050505"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M9 11.5h6"
          stroke="#050505"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M12 8.5v6"
          stroke="#050505"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

function ForgotPasswordModal({ onClose }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

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
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm animate-fade-in sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[420px] rounded-[22px] border border-white/10 bg-surface-elevated p-6 shadow-card-lg animate-fade-in sm:p-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="text-[20px] font-extrabold tracking-[-0.02em] text-white">
              Reset password
            </div>
            <p className="mt-1 text-sm leading-6 text-ink-secondary">
              Enter your email and we&apos;ll send a reset link.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close reset password modal"
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-ink-secondary transition hover:bg-white/[0.08] hover:text-white"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {status === 'success' ? (
          <div>
            <div className="mb-5 rounded-xl border border-green-400/20 bg-green-400/10 p-4 text-sm font-medium leading-6 text-green-200">
              If an account exists for that email, a reset link has been sent.
            </div>

            <button type="button" onClick={onClose} className={primaryBtnClass}>
              Back to login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {status === 'error' && (
              <div className="mb-4 rounded-xl border border-red-400/20 bg-red-400/10 p-3.5 text-sm font-medium text-red-200">
                Something went wrong. Please try again.
              </div>
            )}

            <div className="mb-6">
              <label className={fieldLabelClass}>Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="your@email.com"
                className={inputClass}
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onClose}
                className={`${secondaryBtnClass} flex-1`}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={loading}
                className={`${primaryBtnClass} flex-1`}
              >
                {loading ? (
                  <>
                    <span
                      className="h-4 w-4 animate-spin rounded-full border-2 border-navy/30 border-t-navy"
                      role="status"
                      aria-label="Sending"
                    />
                    Sending…
                  </>
                ) : (
                  'Send reset link'
                )}
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
  const { ready: authReady, user: authUser } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const performLogin = async (url, body, fallbackMessage) => {
    setError('');
    setLoading(true);

    try {
      const data = await apiFetch(url, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      });

      setCsrfToken(data.csrfToken);
      setCurrentUser(data.user);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || fallbackMessage || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    performLogin(
      '/api/auth/login',
      { identifier: identifier.trim(), password },
      'Invalid credentials. Please try again.',
    );
  };

  const loginWithDemoAccount = () =>
    performLogin('/api/auth/demo-login', undefined, 'Demo login failed. Please try again.');

  /* Hold the page while we restore any existing session */
  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg px-4 font-sans">
        <div
          className="h-5 w-5 animate-spin rounded-full border-2 border-amber/30 border-t-amber"
          role="status"
          aria-label="Loading session"
        />
      </div>
    );
  }

  /* Already signed in — bounce to the dashboard */
  if (authUser) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-bg px-4 py-10 font-sans sm:px-6"
      style={{
        background:
          'radial-gradient(circle at top right, rgba(245,185,66,0.14), transparent 32rem), radial-gradient(circle at bottom left, rgba(245,185,66,0.06), transparent 28rem), #050505',
      }}
    >
      {showForgotPassword && (
        <ForgotPasswordModal onClose={() => setShowForgotPassword(false)} />
      )}

      <div className="w-full max-w-[440px] animate-fade-in">
        {/* Brand header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-3">
            <BrandMark />

            <div className="text-left">
              <div className="text-[29px] font-extrabold leading-none tracking-[-0.03em] text-white">
                BeeKeepr
              </div>
              <div className="mt-1 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                Hive monitoring
              </div>
            </div>
          </div>
        </div>

        {/* Login card */}
        <div className="overflow-hidden rounded-[22px] border border-white/10 bg-surface-elevated shadow-card-lg backdrop-blur">
          {/* Accent bar */}
          <div
            className="h-1"
            style={{
              background:
                'linear-gradient(90deg, rgba(245,185,66,0.18) 0%, #f5b942 50%, rgba(245,185,66,0.18) 100%)',
            }}
          />

          <div className="px-5 py-6 sm:px-8 sm:py-8">
            {/* Card heading */}
            <div className="mb-6">
              <h1 className="text-[24px] font-extrabold leading-tight tracking-[-0.03em] text-white">
                Welcome back
              </h1>
            </div>

            {/* Error banner */}
            {error && (
              <div
                role="alert"
                className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-400/20 bg-red-400/10 p-3.5 text-sm font-medium leading-6 text-red-200"
              >
                <svg
                  className="mt-0.5 shrink-0"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin}>
              {/* Identifier */}
              <div className="mb-5">
                <label className={fieldLabelClass}>Email or username</label>

                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                  </span>

                  <input
                    type="text"
                    autoComplete="username"
                    placeholder="beekeeper@example.com or beekeeper123"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    required
                    autoFocus
                    className={`${inputClass} pl-10`}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="mb-5">
                <label className={fieldLabelClass}>Password</label>

                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </span>

                  <input
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className={`${inputClass} pl-10`}
                  />
                </div>
              </div>

              {/* Submit */}
              <div className="flex gap-3">
                {SHOW_DEMO_LOGIN && (
                  <button
                    type="button"
                    onClick={loginWithDemoAccount}
                    disabled={loading}
                    className="h-12 flex-1 cursor-pointer rounded-xl border border-amber/30 bg-amber/[0.08] px-4 text-[12px] font-extrabold uppercase tracking-[0.06em] text-amber transition hover:bg-amber/15 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Log into demo
                  </button>
                )}
                <button type="submit" disabled={loading} className={`${primaryBtnClass} flex-1`}>
                  {loading ? (
                    <>
                      <span
                        className="h-4 w-4 animate-spin rounded-full border-2 border-navy/30 border-t-navy"
                        role="status"
                        aria-label="Signing in"
                      />
                      Signing in…
                    </>
                  ) : (
                    <>
                      Sign in
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      >
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Footer links */}
            <div className="mt-6 flex items-center justify-between gap-3 text-[13px]">
              <span className="text-ink-muted">
                New to BeeKeepr?{' '}
                <Link
                  to="/signup"
                  className="font-semibold text-amber transition hover:opacity-75"
                  style={{ textDecoration: 'none' }}
                >
                  Sign up
                </Link>
              </span>
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="cursor-pointer bg-transparent p-0 font-semibold text-amber transition hover:opacity-75"
              >
                Forgot password?
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}