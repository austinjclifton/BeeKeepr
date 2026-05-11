import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../api';

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
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(circle at top right, rgba(245,185,66,0.12), transparent 30rem), var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>
      <form
        onSubmit={handleSubmit}
        className="analytics-card"
        style={{ width: '100%', maxWidth: '420px', padding: '32px', animation: 'fadeIn 0.3s ease' }}
      >
        <div style={{ marginBottom: '24px' }}>
          <div style={{ color: 'var(--amber)', fontSize: '12px', fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Account Security
          </div>
          <h1 style={{ color: 'var(--text-primary)', fontSize: '28px', lineHeight: 1.1, marginTop: '6px' }}>Reset Password</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '8px' }}>
            Enter a new password for your BeeKeepr account.
          </p>
        </div>

        {error && (
          <div style={{ marginBottom: '16px', padding: '12px 14px', background: 'rgba(239,68,68,0.14)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: '10px', color: '#fecaca', fontSize: '13px', fontWeight: 700 }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ marginBottom: '16px', padding: '12px 14px', background: 'rgba(34,197,94,0.14)', border: '1px solid rgba(34,197,94,0.35)', borderRadius: '10px', color: '#bbf7d0', fontSize: '13px', fontWeight: 700 }}>
            Password reset. Returning to login…
          </div>
        )}

        <div style={{ display: 'grid', gap: '14px' }}>
          <label>
            <div className="field-label" style={{ marginBottom: '8px' }}>New Password</div>
            <input
              className="dark-input"
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              autoComplete="new-password"
            />
          </label>
          <label>
            <div className="field-label" style={{ marginBottom: '8px' }}>Confirm Password</div>
            <input
              className="dark-input"
              type="password"
              value={confirm}
              onChange={event => setConfirm(event.target.value)}
              autoComplete="new-password"
            />
          </label>
          <button type="submit" className="primary-btn" disabled={loading || success}>
            {loading ? 'Resetting…' : 'Reset Password'}
          </button>
          <Link to="/" className="ghost-btn" style={{ textAlign: 'center' }}>
            Back to Login
          </Link>
        </div>
      </form>
    </div>
  );
}
