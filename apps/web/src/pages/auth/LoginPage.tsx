import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api, setAccessToken, ApiRequestError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { getErrorMessage } from '@/lib/utils';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((s) => s.login);

  const [loginField, setLoginField] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaBackupCode, setMfaBackupCode] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaMode, setMfaMode] = useState<'totp' | 'backup'>('totp');
  const [error, setError] = useState('');
  const [showVerifyLink, setShowVerifyLink] = useState(false);
  const [loading, setLoading] = useState(false);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setShowVerifyLink(false);
    setLoading(true);

    try {
      const res = await api.auth.login({
        login: loginField,
        password,
        mfaCode: mfaRequired && mfaMode === 'totp' ? mfaCode : undefined,
        mfaBackupCode: mfaRequired && mfaMode === 'backup' ? mfaBackupCode : undefined,
      });
      setAccessToken(res.accessToken);

      // Fetch full user profile
      const me = await api.users.getMe();
      login({
        id: me.id,
        username: me.username,
        email: me.email,
        displayName: me.profile.displayName,
        avatarHash: me.profile.avatarHash,
        tier: me.profile.tier,
      });

      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiRequestError) {
        if (err.code === 'EMAIL_NOT_VERIFIED') {
          setShowVerifyLink(true);
        }
        if (err.code === 'MFA_REQUIRED') {
          setMfaRequired(true);
          setError('Enter your 2FA code to continue.');
          return;
        }
        if (err.code === 'INVALID_MFA_CODE') {
          setMfaRequired(true);
        }
      }
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <h2 className="auth-heading">Welcome back!</h2>
      <p className="auth-subheading">We're so excited to see you again!</p>

      {error && <div className="auth-error">{error}</div>}

      <Input
        label="Email or Username"
        type="text"
        value={loginField}
        onChange={(e) => setLoginField(e.target.value)}
        required
        autoComplete="username"
        autoFocus
      />

      <Input
        label="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        autoComplete="current-password"
      />

      {mfaRequired && (
        <div className="auth-mfa-panel">
          <div className="auth-mfa-toggle">
            <button
              type="button"
              className={`auth-mfa-mode ${mfaMode === 'totp' ? 'active' : ''}`}
              onClick={() => setMfaMode('totp')}
            >
              Authenticator App
            </button>
            <button
              type="button"
              className={`auth-mfa-mode ${mfaMode === 'backup' ? 'active' : ''}`}
              onClick={() => setMfaMode('backup')}
            >
              Backup Code
            </button>
          </div>

          {mfaMode === 'totp' ? (
            <Input
              label="6-digit code"
              type="text"
              inputMode="numeric"
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              autoComplete="one-time-code"
              hint="Open your authenticator app and enter the current code."
            />
          ) : (
            <Input
              label="Backup code"
              type="text"
              value={mfaBackupCode}
              onChange={(e) => setMfaBackupCode(e.target.value.toUpperCase())}
              hint="Backup codes can only be used once."
            />
          )}
        </div>
      )}

      <Button type="submit" loading={loading} className="auth-submit">
        {mfaRequired ? 'Verify & Log In' : 'Log In'}
      </Button>

      <p className="auth-link">
        Need an account? <Link to="/register">Register</Link>
      </p>

      {showVerifyLink && (
        <p className="auth-link">
          <Link
            to={`/verify-email/pending?email=${encodeURIComponent(loginField.includes('@') ? loginField : '')}`}
          >
            Resend verification email
          </Link>
        </p>
      )}
    </form>
  );
}
