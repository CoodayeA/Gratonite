import React, { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api, setAccessToken, ApiRequestError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { getErrorMessage } from '@/lib/utils';

/* ---------- styles ---------- */

const S = {
  authForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: 28,
  } as React.CSSProperties,
  logoWrap: {
    display: 'flex',
    justifyContent: 'center',
  } as React.CSSProperties,
  headingWrap: {
    textAlign: 'center',
  } as React.CSSProperties,
  heading: {
    fontSize: 28,
    fontWeight: 600,
    color: 'var(--text)',
    marginBottom: 8,
    margin: 0,
  } as React.CSSProperties,
  subheading: {
    fontSize: 14,
    color: 'var(--text-muted)',
    margin: 0,
  } as React.CSSProperties,
  authError: {
    padding: '10px 14px',
    background: 'var(--danger-bg)',
    border: '1px solid rgba(255, 107, 107, 0.25)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--danger)',
    fontSize: 13,
  } as React.CSSProperties,
  fieldsGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  } as React.CSSProperties,
  forgotRow: {
    display: 'flex',
    justifyContent: 'flex-end',
  } as React.CSSProperties,
  forgotLink: {
    fontSize: 13,
    color: 'var(--accent)',
    fontWeight: 500,
    textDecoration: 'none',
  } as React.CSSProperties,
  submitBtn: {
    background: 'var(--accent)',
    color: 'var(--text-on-gold)',
    height: 48,
    borderRadius: 'var(--radius-sm)',
    fontSize: 15,
    fontWeight: 600,
    border: 'none',
    width: '100%',
  } as React.CSSProperties,
  signupText: {
    textAlign: 'center',
    fontSize: 14,
    color: 'var(--text-faint)',
    margin: 0,
  } as React.CSSProperties,
  signupLink: {
    color: 'var(--accent)',
    fontWeight: 500,
  } as React.CSSProperties,
  verifyText: {
    textAlign: 'center',
    fontSize: 13,
    color: 'var(--text-muted)',
    margin: 0,
  } as React.CSSProperties,
  verifyLink: {
    color: 'var(--accent)',
  } as React.CSSProperties,
  mfaOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.48)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  } as React.CSSProperties,
  mfaForm: {
    width: 420,
    maxWidth: '90vw',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--stroke)',
    borderRadius: 10,
    padding: 48,
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  } as React.CSSProperties,
  mfaIconWrap: {
    display: 'flex',
    justifyContent: 'center',
  } as React.CSSProperties,
  mfaIcon: {
    width: 48,
    height: 48,
    borderRadius: 10,
    background: 'var(--gold-subtle)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as React.CSSProperties,
  mfaHeadingWrap: {
    textAlign: 'center',
  } as React.CSSProperties,
  mfaHeading: {
    fontSize: 20,
    fontWeight: 600,
    color: 'var(--text)',
    margin: 0,
    marginBottom: 8,
  } as React.CSSProperties,
  mfaSubheading: {
    fontSize: 14,
    color: 'var(--text-muted)',
    margin: 0,
  } as React.CSSProperties,
  mfaDigitsRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: 8,
  } as React.CSSProperties,
  mfaDigitInput: {
    width: 48,
    height: 56,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 600,
    color: 'var(--text)',
    background: 'var(--bg-input)',
    border: '1px solid var(--stroke)',
    borderRadius: 'var(--radius-md)',
    outline: 'none',
    caretColor: 'var(--accent)',
  } as React.CSSProperties,
  mfaToggle: {
    textAlign: 'center',
  } as React.CSSProperties,
  mfaToggleBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--accent)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    padding: 0,
  } as React.CSSProperties,
};

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

  // Individual digit state for MFA TOTP input
  const [mfaDigits, setMfaDigits] = useState<string[]>(['', '', '', '', '', '']);
  const digitRefs = useRef<(HTMLInputElement | null)[]>([]);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/';

  // Sync mfaDigits to mfaCode
  useEffect(() => {
    setMfaCode(mfaDigits.join(''));
  }, [mfaDigits]);

  // Auto-focus first digit input when MFA overlay opens in totp mode
  useEffect(() => {
    if (mfaRequired && mfaMode === 'totp') {
      setTimeout(() => digitRefs.current[0]?.focus(), 50);
    }
  }, [mfaRequired, mfaMode]);

  function handleDigitChange(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...mfaDigits];
    newDigits[index] = digit;
    setMfaDigits(newDigits);

    if (digit && index < 5) {
      digitRefs.current[index + 1]?.focus();
    }
  }

  function handleDigitKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !mfaDigits[index] && index > 0) {
      digitRefs.current[index - 1]?.focus();
    }
  }

  function handleDigitPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newDigits = [...mfaDigits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pasted[i] || '';
    }
    setMfaDigits(newDigits);
    const focusIndex = Math.min(pasted.length, 5);
    digitRefs.current[focusIndex]?.focus();
  }

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
        displayName: me.profile?.displayName ?? me.username,
        avatarHash: me.profile?.avatarHash ?? null,
        tier: me.profile?.tier ?? 'free',
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

  function handleMfaSubmit(e: FormEvent) {
    e.preventDefault();
    handleSubmit(e);
  }

  return (
    <>
      <form style={S.authForm} onSubmit={handleSubmit}>
        {/* Logo */}
        <div style={S.logoWrap}>
          <img
            src={`${import.meta.env.BASE_URL}gratonite-icon.png`}
            alt="Gratonite"
            style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover' }}
          />
        </div>

        {/* Heading */}
        <div style={S.headingWrap}>
          <h2 style={S.heading}>
            Welcome Back
          </h2>
          <p style={S.subheading}>
            Sign in to your Gratonite account
          </p>
        </div>

        {/* Error */}
        {error && !mfaRequired && <div style={S.authError}>{error}</div>}

        {/* Fields */}
        <div style={S.fieldsGroup}>
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

          <div style={S.forgotRow}>
            <Link
              to="/forgot-password"
              style={S.forgotLink}
            >
              Forgot password?
            </Link>
          </div>
        </div>

        {/* Sign In button */}
        <Button
          type="submit"
          loading={loading}
          style={S.submitBtn}
        >
          Sign In
        </Button>

        {/* Sign up link */}
        <p style={S.signupText}>
          Don&apos;t have an account?{' '}
          <Link to="/register" style={S.signupLink}>
            Sign up
          </Link>
        </p>

        {showVerifyLink && (
          <p style={S.verifyText}>
            <Link
              to={`/verify-email/pending?email=${encodeURIComponent(loginField.includes('@') ? loginField : '')}`}
              style={S.verifyLink}
            >
              Resend verification email
            </Link>
          </p>
        )}
      </form>

      {/* MFA Overlay */}
      {mfaRequired && (
        <div
          style={S.mfaOverlay}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setMfaRequired(false);
              setMfaDigits(['', '', '', '', '', '']);
              setMfaCode('');
              setMfaBackupCode('');
              setError('');
            }
          }}
        >
          <form
            onSubmit={handleMfaSubmit}
            style={S.mfaForm}
            onClick={(e) => e.stopPropagation()}
          >
            {/* MFA Icon */}
            <div style={S.mfaIconWrap}>
              <div style={S.mfaIcon}>
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
              </div>
            </div>

            {/* MFA Heading */}
            <div style={S.mfaHeadingWrap}>
              <h3 style={S.mfaHeading}>
                Two-Factor Authentication
              </h3>
              <p style={S.mfaSubheading}>
                {mfaMode === 'totp'
                  ? 'Enter the 6-digit code from your authenticator app'
                  : 'Enter one of your backup codes'}
              </p>
            </div>

            {/* Error in MFA modal */}
            {error && <div style={S.authError}>{error}</div>}

            {/* TOTP digit inputs */}
            {mfaMode === 'totp' ? (
              <div style={S.mfaDigitsRow}>
                {mfaDigits.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      digitRefs.current[i] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    autoComplete={i === 0 ? 'one-time-code' : 'off'}
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigitChange(i, e.target.value)}
                    onKeyDown={(e) => handleDigitKeyDown(i, e)}
                    onPaste={i === 0 ? handleDigitPaste : undefined}
                    style={S.mfaDigitInput}
                    onFocus={(e) => {
                      e.target.style.borderColor = 'var(--accent)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'var(--stroke)';
                    }}
                  />
                ))}
              </div>
            ) : (
              <Input
                label="Backup code"
                type="text"
                value={mfaBackupCode}
                onChange={(e) => setMfaBackupCode(e.target.value.toUpperCase())}
                hint="Backup codes can only be used once."
                autoFocus
              />
            )}

            {/* Verify button */}
            <Button
              type="submit"
              loading={loading}
              style={S.submitBtn}
            >
              Verify
            </Button>

            {/* Toggle MFA mode link */}
            <div style={S.mfaToggle}>
              <button
                type="button"
                onClick={() => {
                  if (mfaMode === 'totp') {
                    setMfaMode('backup');
                  } else {
                    setMfaMode('totp');
                    setMfaDigits(['', '', '', '', '', '']);
                  }
                }}
                style={S.mfaToggleBtn}
              >
                {mfaMode === 'totp' ? 'Use backup code instead' : 'Use authenticator app instead'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
