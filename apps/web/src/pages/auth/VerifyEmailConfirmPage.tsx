import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, setAccessToken } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';

/* ── Spinner keyframes (injected once) ─────────────────────────────── */

const spinnerStyleId = 'verify-email-spinner-keyframes';

function ensureSpinnerKeyframes() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(spinnerStyleId)) return;
  const style = document.createElement('style');
  style.id = spinnerStyleId;
  style.textContent = `
    @keyframes verify-spin {
      0%   { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}

/* ── Inline style objects ──────────────────────────────────────────── */

const styles = {
  page: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: 'var(--bg)',
    padding: 24,
  } as React.CSSProperties,

  card: {
    width: 480,
    maxWidth: '100%',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--stroke)',
    borderRadius: 10,
    paddingTop: 48,
    paddingBottom: 40,
    paddingLeft: 48,
    paddingRight: 48,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 24,
  } as React.CSSProperties,

  /* Loading state spinner */
  spinnerRing: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    border: '3px solid transparent',
    borderTopColor: 'var(--accent)',
    borderRightColor: 'var(--accent)',
    animation: 'verify-spin 1s linear infinite',
    boxSizing: 'border-box',
  } as React.CSSProperties,

  /* Success state checkmark circle */
  checkmarkCircle: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    background: '#4a8a5a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  } as React.CSSProperties,

  /* Error state icon circle */
  errorCircle: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    background: 'rgba(220, 50, 50, 0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  } as React.CSSProperties,

  statusLabelLoading: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: 2,
    color: 'var(--accent)',
    textTransform: 'uppercase',
    margin: 0,
    marginTop: -8,
  } as React.CSSProperties,

  statusLabelVerified: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: 2,
    color: 'var(--accent-3)',
    textTransform: 'uppercase',
    margin: 0,
    marginTop: -8,
  } as React.CSSProperties,

  statusLabelError: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: 2,
    color: '#f87171',
    textTransform: 'uppercase',
    margin: 0,
    marginTop: -8,
  } as React.CSSProperties,

  heading: {
    fontSize: 26,
    fontWeight: 600,
    color: 'var(--text)',
    margin: 0,
    textAlign: 'center',
    lineHeight: 1.2,
  } as React.CSSProperties,

  description: {
    fontSize: 14,
    color: 'var(--text-muted)',
    margin: 0,
    textAlign: 'center',
    lineHeight: 1.6,
    maxWidth: 340,
  } as React.CSSProperties,

  errorMessage: {
    fontSize: 14,
    color: '#f87171',
    margin: 0,
    textAlign: 'center',
    lineHeight: 1.6,
    maxWidth: 340,
  } as React.CSSProperties,

  continueButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 220,
    height: 44,
    borderRadius: 'var(--radius-sm)',
    background: 'var(--accent)',
    color: 'var(--text-on-gold)',
    fontSize: 15,
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    textDecoration: 'none',
    marginTop: 4,
  } as React.CSSProperties,

  requestLinkButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 220,
    height: 44,
    borderRadius: 'var(--radius-sm)',
    background: 'transparent',
    color: 'var(--accent)',
    fontSize: 15,
    fontWeight: 600,
    border: '1px solid var(--stroke)',
    cursor: 'pointer',
    textDecoration: 'none',
    marginTop: 4,
  } as React.CSSProperties,
} as const;

/* ── Types ─────────────────────────────────────────────────────────── */

type VerifyState = 'loading' | 'success' | 'error';

/* ── Component ─────────────────────────────────────────────────────── */

export function VerifyEmailConfirmPage() {
  ensureSpinnerKeyframes();

  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get('token') ?? '', [searchParams]);
  const email = useMemo(() => searchParams.get('email') ?? '', [searchParams]);
  const [state, setState] = useState<VerifyState>('loading');
  const [message, setMessage] = useState('Verifying your email...');

  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!token) {
        setState('error');
        setMessage('Verification link is missing a token.');
        return;
      }

      try {
        const res = await api.auth.confirmEmailVerification(token);
        if (cancelled) return;
        setAccessToken(res.accessToken);
        const me = await api.users.getMe();
        login({
          id: me.id,
          username: me.username,
          email: me.email,
          displayName: me.profile?.displayName ?? me.username,
          avatarHash: me.profile?.avatarHash ?? null,
          tier: me.profile?.tier ?? 'free',
        });
        navigate('/onboarding/account', { replace: true });
      } catch (err) {
        if (cancelled) return;
        setState('error');
        setMessage(getErrorMessage(err));
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div style={styles.page}>
      <div style={styles.card}>

        {/* ── Loading state ──────────────────────────────────────── */}
        {state === 'loading' && (
          <>
            <div style={styles.spinnerRing} />
            <p style={styles.statusLabelLoading}>VERIFYING</p>
            <h2 style={styles.heading}>Verifying Email</h2>
            <p style={styles.description}>
              Please wait while we verify your email address. This usually takes just a moment.
            </p>
          </>
        )}

        {/* ── Success state ─────────────────────────────────────── */}
        {state === 'success' && (
          <>
            {/* Checkmark circle */}
            <div style={styles.checkmarkCircle}>
              <svg
                width="32"
                height="32"
                viewBox="0 0 32 32"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M9 16.5L14 21.5L23 11.5"
                  stroke="white"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <p style={styles.statusLabelVerified}>VERIFIED</p>
            <h2 style={styles.heading}>Email Verified!</h2>
            <p style={styles.description}>
              Congratulations! Your email address has been successfully verified. You can now sign in to your account.
            </p>
          </>
        )}

        {/* ── Error state ───────────────────────────────────────── */}
        {state === 'error' && (
          <>
            {/* Error icon circle */}
            <div style={styles.errorCircle}>
              <svg
                width="32"
                height="32"
                viewBox="0 0 32 32"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M11 11L21 21M21 11L11 21"
                  stroke="#f87171"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <p style={styles.statusLabelError}>FAILED</p>
            <h2 style={styles.heading}>Verification Failed</h2>
            <p style={styles.errorMessage}>{message}</p>
            <p style={styles.description}>
              The link may be expired or invalid. Request a new verification email and try again.
            </p>

            <Link
              to={
                email
                  ? `/verify-email/pending?email=${encodeURIComponent(email)}`
                  : '/verify-email/pending'
              }
              style={styles.requestLinkButton}
            >
              Request New Link
            </Link>
          </>
        )}

      </div>
    </div>
  );
}
