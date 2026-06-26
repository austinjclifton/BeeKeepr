import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../api';

const fieldLabelClass = 'mb-2 text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink-muted';
const inputClass = 'w-full rounded-md border border-line bg-white/[0.05] px-3 py-2.5 text-sm text-white outline-none focus:border-amber';
const primaryBtnClass = 'cursor-pointer rounded-pill border-none bg-amber px-3.5 py-2.5 text-[12px] font-black text-navy transition disabled:cursor-not-allowed disabled:opacity-55';
const ghostBtnClass = 'cursor-pointer rounded-pill border border-line bg-white/[0.05] px-3 py-2 text-center text-[12px] font-extrabold text-ink-secondary transition hover:border-amber/45 hover:text-white';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const token = searchParams.get('token') || '';

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!token) {
      setError('Reset token is missing.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      await apiFetch('/api/auth/reset-password/confirm', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword: password }),
      });
      setSuccess(true);
      setTimeout(() => navigate('/'), 1200);
    } catch (err) {
      setError(err.message || 'Unable to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-bg p-6 font-sans"
      style={{ background: 'radial-gradient(circle at top right, rgba(245,185,66,0.12), transparent 30rem), #050505' }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-[420px] animate-fade-in p-8"
      >
        <div className="mb-6">
          <div className="text-[12px] font-black uppercase tracking-[0.08em] text-amber">
            Account Security
          </div>
          <h1 className="mt-1.5 text-[28px] leading-[1.1] text-white">Reset Password</h1>
          <p className="mt-2 text-[14px] text-ink-secondary">
            Enter a new password for your BeeKeepr account.
          </p>
        </div>

        {error && (
          <div
            className="mb-4 rounded-md border border-red-500/35 bg-red-500/15 p-3 text-[13px] font-bold text-red-200"
          >
            {error}
          </div>
        )}
        {success && (
          <div
            className="mb-4 rounded-md border border-green-500/35 bg-green-500/15 p-3 text-[13px] font-bold text-green-200"
          >
            Password reset. Returning to login…
          </div>
        )}

        <div className="grid gap-3.5">
          <label>
            <div className={fieldLabelClass}>New Password</div>
            <input
              className={inputClass}
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              autoComplete="new-password"
            />
          </label>
          <label>
            <div className={fieldLabelClass}>Confirm Password</div>
            <input
              className={inputClass}
              type="password"
              value={confirm}
              onChange={event => setConfirm(event.target.value)}
              autoComplete="new-password"
            />
          </label>
          <button type="submit" className={primaryBtnClass} disabled={loading || success}>
            {loading ? 'Resetting…' : 'Reset Password'}
          </button>
          <Link to="/" className={ghostBtnClass}>
            Back to Login
          </Link>
        </div>
      </form>
    </div>
  );
}
