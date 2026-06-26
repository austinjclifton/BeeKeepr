import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiFetch, setCsrfToken, setCurrentUser } from '../api';

const fieldLabelClass = 'mb-1.5 block text-[11px] font-bold uppercase tracking-[0.08em] text-ink-secondary';
const inputClass = 'w-full rounded-[10px] border border-line bg-white/[0.05] px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-ink-muted focus:border-amber focus:bg-white/[0.08]';
const primaryBtnClass = 'flex w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] border-none bg-amber px-3.5 py-3.5 text-sm font-bold text-navy transition hover:bg-amber-light disabled:cursor-not-allowed disabled:opacity-60';

export default function SignUpPage() {
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function validate() {
    if (!username.trim()) return 'Username is required.';
    if (username.trim().length < 3) return 'Username must be at least 3 characters.';
    if (!email.trim()) return 'Email is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return 'Please enter a valid email address.';
    if (!password) return 'Password is required.';
    if (password.length < 8) return 'Password must be at least 8 characters.';
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
      // Register and seed session
      const data = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim(),
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

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-bg p-6 font-sans"
      style={{ background: 'radial-gradient(circle at top right, rgba(245,185,66,0.12), transparent 30rem), #050505' }}
    >
      <div className="w-full max-w-[420px] animate-fade-in">

        {/* Brand header */}
        <div className="mb-8 text-center">
          <div className="mb-2 inline-flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-amber">
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

        {/* Sign-up card */}
        <div className="overflow-hidden rounded-lg border border-line bg-surface-elevated shadow-card-lg">
          {/* Accent bar */}
          <div className="h-1" style={{ background: 'linear-gradient(90deg, #050505 0%, #f5b942 100%)' }} />

          <div className="px-9 pt-9 pb-8">
            <div className="mb-6">
              <div className="mb-1 text-[18px] font-extrabold text-white">
                Create your account
              </div>
              <div className="text-[13px] text-ink-muted">
                Already have an account?{' '}
                <Link
                  to="/"
                  className="font-semibold text-amber transition hover:opacity-75"
                  style={{ textDecoration: 'none' }}
                >
                  Sign in
                </Link>
              </div>
            </div>

            {/* Error banner */}
            {error && (
              <div className="mb-5 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-[13px] font-medium text-red-700">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {error}
              </div>
            )}

            <form onSubmit={handleSignUp} noValidate>

              {/* Username */}
              <div className="mb-[18px]">
                <label className={fieldLabelClass}>
                  Username
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    placeholder="e.g. beekeeper42"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    required
                    autoFocus
                    className={`${inputClass} pl-10`}
                  />
                </div>
              </div>

              {/* Email */}
              <div className="mb-[18px]">
                <label className={fieldLabelClass}>
                  Email Address
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                  </span>
                  <input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className={`${inputClass} pl-10`}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="mb-[18px]">
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
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    className={`${inputClass} pl-10`}
                  />
                </div>
              </div>

              {/* Confirm Password */}
              <div className="mb-7">
                <label className={fieldLabelClass}>
                  Confirm Password
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
                    placeholder="Repeat your password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                    className={`${inputClass} pl-10`}
                    style={{
                      borderColor: confirmPassword && password !== confirmPassword
                        ? '#fca5a5'
                        : undefined,
                    }}
                  />
                </div>
                {/* Mismatch hint */}
                {confirmPassword && password !== confirmPassword && (
                  <div className="mt-1.5 text-[12px] text-red-700">
                    Passwords do not match
                  </div>
                )}
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
                    Creating account…
                  </>
                ) : (
                  <>
                    Create Account
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
