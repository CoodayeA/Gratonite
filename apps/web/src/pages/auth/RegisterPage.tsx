import { useState, useRef, useEffect, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api, setAccessToken, ApiRequestError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { getErrorMessage } from '@/lib/utils';

/* ── Inline style objects (design tokens via CSS variables) ────────── */

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
    width: 550,
    maxWidth: '100%',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--stroke)',
    borderRadius: 10,
    paddingTop: 40,
    paddingBottom: 40,
    paddingLeft: 44,
    paddingRight: 44,
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  } as React.CSSProperties,

  logo: {
    width: 48,
    height: 48,
    borderRadius: 10,
    background: 'var(--accent)',
    color: 'var(--text-on-gold)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 24,
    fontWeight: 700,
    flexShrink: 0,
  } as React.CSSProperties,

  heading: {
    fontSize: 26,
    fontWeight: 600,
    color: 'var(--text)',
    margin: 0,
    lineHeight: 1.2,
  } as React.CSSProperties,

  subheading: {
    fontSize: 14,
    color: 'var(--text-muted)',
    margin: '4px 0 0',
  } as React.CSSProperties,

  fieldsGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  } as React.CSSProperties,

  nameRow: {
    display: 'flex',
    gap: 12,
  } as React.CSSProperties,

  nameField: {
    flex: 1,
    minWidth: 0,
  } as React.CSSProperties,

  dobRow: {
    display: 'flex',
    gap: 12,
  } as React.CSSProperties,

  dobLabel: {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--text-muted)',
    marginBottom: 6,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  } as React.CSSProperties,

  select: {
    flex: 1,
    height: 48,
    background: 'var(--frosted-glass)',
    border: '1px solid var(--stroke)',
    borderRadius: 6,
    color: 'var(--text)',
    fontSize: 14,
    paddingLeft: 14,
    paddingRight: 14,
    outline: 'none',
    appearance: 'none' as const,
    WebkitAppearance: 'none' as const,
    cursor: 'pointer',
    backgroundImage:
      'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'8\' viewBox=\'0 0 12 8\'%3E%3Cpath fill=\'%23a8a4b8\' d=\'M1.41.59L6 5.17 10.59.59 12 2l-6 6-6-6z\'/%3E%3C/svg%3E")',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 14px center',
  } as React.CSSProperties,

  selectPlaceholder: {
    color: 'var(--text-faint)',
  } as React.CSSProperties,

  termsRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    cursor: 'pointer',
  } as React.CSSProperties,

  checkbox: (checked: boolean) =>
    ({
      width: 18,
      height: 18,
      minWidth: 18,
      borderRadius: 4,
      border: `1px solid ${checked ? 'var(--accent)' : 'var(--stroke)'}`,
      background: checked ? 'var(--accent)' : 'transparent',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      flexShrink: 0,
      marginTop: 1,
      transition: 'all 0.15s ease',
    }) as React.CSSProperties,

  termsText: {
    fontSize: 12,
    color: 'var(--text-faint)',
    lineHeight: 1.5,
    userSelect: 'none' as const,
  } as React.CSSProperties,

  termsLink: {
    color: 'var(--accent)',
    textDecoration: 'none',
  } as React.CSSProperties,

  submitButton: {
    width: '100%',
    height: 48,
    borderRadius: 6,
    background: 'var(--accent)',
    color: 'var(--text-on-gold)',
    fontSize: 15,
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
  } as React.CSSProperties,

  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  } as React.CSSProperties,

  dividerLine: {
    flex: 1,
    height: 1,
    background: 'var(--stroke)',
  } as React.CSSProperties,

  dividerText: {
    fontSize: 12,
    color: 'var(--text-faint)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  } as React.CSSProperties,

  oauthGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  } as React.CSSProperties,

  oauthButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    height: 42,
    background: 'transparent',
    border: '1px solid var(--stroke)',
    borderRadius: 6,
    color: 'var(--text)',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'border-color 0.15s ease',
  } as React.CSSProperties,

  signInRow: {
    textAlign: 'center' as const,
    fontSize: 14,
  } as React.CSSProperties,

  signInText: {
    color: 'var(--text-faint)',
  } as React.CSSProperties,

  signInLink: {
    color: 'var(--accent)',
    textDecoration: 'none',
    fontWeight: 500,
    marginLeft: 4,
  } as React.CSSProperties,

  error: {
    background: 'rgba(220, 50, 50, 0.12)',
    border: '1px solid rgba(220, 50, 50, 0.3)',
    borderRadius: 6,
    padding: '10px 14px',
    fontSize: 13,
    color: '#f87171',
    lineHeight: 1.5,
  } as React.CSSProperties,

  dobError: {
    fontSize: 12,
    color: '#f87171',
    marginTop: 4,
  } as React.CSSProperties,
} as const;

/* ── Month / Day helpers ───────────────────────────────────────────── */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function daysInMonth(month: number, year: number): number {
  if (!month || !year) return 31;
  return new Date(year, month, 0).getDate();
}

function buildYearRange(): number[] {
  const current = new Date().getFullYear();
  const years: number[] = [];
  for (let y = current; y >= current - 120; y--) {
    years.push(y);
  }
  return years;
}

const YEARS = buildYearRange();

/* ── Component ─────────────────────────────────────────────────────── */

export function RegisterPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  // Form fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // DOB dropdowns
  const [dobMonth, setDobMonth] = useState('');
  const [dobDay, setDobDay] = useState('');
  const [dobYear, setDobYear] = useState('');

  // Terms
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Derived dateOfBirth string (YYYY-MM-DD)
  const dateOfBirth =
    dobYear && dobMonth && dobDay
      ? `${dobYear}-${dobMonth.padStart(2, '0')}-${dobDay.padStart(2, '0')}`
      : '';

  // Derived displayName
  const displayName =
    firstName && lastName
      ? `${firstName} ${lastName}`
      : firstName || lastName || username;

  // Username availability
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameChecking, setUsernameChecking] = useState(false);

  // Errors & loading
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);

  const usernameTimer = useRef<ReturnType<typeof setTimeout>>();

  // Live username availability check
  useEffect(() => {
    setUsernameAvailable(null);
    if (username.length < 2) return;

    clearTimeout(usernameTimer.current);
    usernameTimer.current = setTimeout(async () => {
      setUsernameChecking(true);
      try {
        const res = await api.auth.checkUsername(username);
        setUsernameAvailable(res.available);
      } catch {
        setUsernameAvailable(null);
      } finally {
        setUsernameChecking(false);
      }
    }, 500);

    return () => clearTimeout(usernameTimer.current);
  }, [username]);

  // Clamp day when month/year changes
  useEffect(() => {
    if (!dobDay) return;
    const maxDay = daysInMonth(Number(dobMonth), Number(dobYear));
    if (Number(dobDay) > maxDay) {
      setDobDay(String(maxDay));
    }
  }, [dobMonth, dobYear, dobDay]);

  // Date-of-birth age validation (16+)
  function validateAge(dob: string): boolean {
    const birth = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age >= 16;
  }

  function getUsernameHint(): string {
    if (usernameChecking) return 'Checking...';
    if (usernameAvailable === true) return 'Username is available!';
    if (usernameAvailable === false) return 'Username is taken.';
    return '';
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    // Terms validation
    if (!termsAccepted) {
      setError('You must agree to the Terms of Service and Privacy Policy.');
      return;
    }

    // DOB completeness check
    if (!dateOfBirth) {
      setError('Please enter your complete date of birth.');
      return;
    }

    // Client-side validations
    if (!validateAge(dateOfBirth)) {
      setError('You must be at least 16 years old to register.');
      return;
    }

    if (usernameAvailable === false) {
      setError('Please choose a different username.');
      return;
    }

    setLoading(true);

    try {
      const res = await api.auth.register({
        email,
        username,
        displayName: displayName || username,
        password,
        dateOfBirth,
      });

      setAccessToken(res.accessToken);

      // Fetch full profile
      const me = await api.users.getMe();
      login({
        id: me.id,
        username: me.username,
        email: me.email,
        displayName: me.profile.displayName,
        avatarHash: me.profile.avatarHash,
        tier: me.profile.tier,
      });

      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof ApiRequestError && err.details) {
        setFieldErrors(err.details);
      }
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  const maxDays = daysInMonth(Number(dobMonth), Number(dobYear));

  return (
    <div style={styles.page}>
      <form style={styles.card} onSubmit={handleSubmit} noValidate>
        {/* Logo */}
        <div style={styles.logo} aria-hidden="true">G</div>

        {/* Heading */}
        <div>
          <h2 style={styles.heading}>Create Account</h2>
          <p style={styles.subheading}>Join the Gratonite community</p>
        </div>

        {/* Error banner */}
        {error && <div style={styles.error}>{error}</div>}

        {/* Fields */}
        <div style={styles.fieldsGroup}>
          {/* Name row */}
          <div style={styles.nameRow}>
            <div style={styles.nameField}>
              <Input
                label="First Name"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                error={fieldErrors['displayName']?.[0]}
                autoComplete="given-name"
                autoFocus
              />
            </div>
            <div style={styles.nameField}>
              <Input
                label="Last Name"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
              />
            </div>
          </div>

          {/* Username */}
          <Input
            label="Username"
            type="text"
            value={username}
            onChange={(e) =>
              setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))
            }
            hint={getUsernameHint()}
            error={
              usernameAvailable === false
                ? 'Username is already taken'
                : fieldErrors['username']?.[0]
            }
            required
            autoComplete="username"
          />

          {/* Email */}
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldErrors['email']?.[0]}
            required
            autoComplete="email"
          />

          {/* Date of Birth row */}
          <div>
            <div style={styles.dobLabel}>Date of Birth</div>
            <div style={styles.dobRow}>
              <select
                style={{
                  ...styles.select,
                  ...(dobMonth === '' ? styles.selectPlaceholder : {}),
                }}
                value={dobMonth}
                onChange={(e) => setDobMonth(e.target.value)}
                aria-label="Month"
                required
              >
                <option value="" disabled hidden>
                  Month
                </option>
                {MONTHS.map((name, i) => (
                  <option key={name} value={String(i + 1)}>
                    {name}
                  </option>
                ))}
              </select>

              <select
                style={{
                  ...styles.select,
                  ...(dobDay === '' ? styles.selectPlaceholder : {}),
                }}
                value={dobDay}
                onChange={(e) => setDobDay(e.target.value)}
                aria-label="Day"
                required
              >
                <option value="" disabled hidden>
                  Day
                </option>
                {Array.from({ length: maxDays }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={String(d)}>
                    {d}
                  </option>
                ))}
              </select>

              <select
                style={{
                  ...styles.select,
                  ...(dobYear === '' ? styles.selectPlaceholder : {}),
                }}
                value={dobYear}
                onChange={(e) => setDobYear(e.target.value)}
                aria-label="Year"
                required
              >
                <option value="" disabled hidden>
                  Year
                </option>
                {YEARS.map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            {fieldErrors['dateOfBirth']?.[0] && (
              <div style={styles.dobError}>{fieldErrors['dateOfBirth'][0]}</div>
            )}
          </div>

          {/* Password */}
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint={
              password.length > 0 && password.length < 8
                ? 'Must be at least 8 characters'
                : ''
            }
            error={fieldErrors['password']?.[0]}
            required
            autoComplete="new-password"
            minLength={8}
          />
        </div>

        {/* Terms checkbox */}
        <label style={styles.termsRow}>
          <div
            style={styles.checkbox(termsAccepted)}
            role="checkbox"
            aria-checked={termsAccepted}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                setTermsAccepted(!termsAccepted);
              }
            }}
          >
            {termsAccepted && (
              <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                <path
                  d="M1 5L4.5 8.5L11 1.5"
                  stroke="var(--text-on-gold)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
            tabIndex={-1}
          />
          <span style={styles.termsText}>
            I agree to the{' '}
            <a href="/terms" style={styles.termsLink} onClick={(e) => e.stopPropagation()}>
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="/privacy" style={styles.termsLink} onClick={(e) => e.stopPropagation()}>
              Privacy Policy
            </a>
          </span>
        </label>

        {/* Create Account button */}
        <Button
          type="submit"
          loading={loading}
          className="auth-submit"
          style={styles.submitButton}
        >
          Create Account
        </Button>

        {/* Divider */}
        <div style={styles.divider}>
          <div style={styles.dividerLine} />
          <span style={styles.dividerText}>or</span>
          <div style={styles.dividerLine} />
        </div>

        {/* OAuth buttons */}
        <div style={styles.oauthGroup}>
          <button
            type="button"
            style={styles.oauthButton}
            onClick={() => alert('Coming soon')}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path
                d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
                fill="#4285F4"
              />
              <path
                d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.26c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"
                fill="#34A853"
              />
              <path
                d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
                fill="#FBBC05"
              />
              <path
                d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </button>

          <button
            type="button"
            style={styles.oauthButton}
            onClick={() => alert('Coming soon')}
          >
            <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden="true">
              <path
                d="M15.248 1.188A14.72 14.72 0 0011.6 0a.055.055 0 00-.058.028 10.26 10.26 0 00-.453.93 13.584 13.584 0 00-4.078 0 9.42 9.42 0 00-.46-.93A.057.057 0 006.493 0a14.68 14.68 0 00-3.649 1.188.052.052 0 00-.024.02C.412 4.434-.247 7.58.077 10.684a.06.06 0 00.023.041 14.8 14.8 0 004.46 2.254.058.058 0 00.063-.02c.344-.47.65-.964.913-1.484a.056.056 0 00-.031-.078 9.75 9.75 0 01-1.392-.663.057.057 0 01-.006-.094c.094-.07.187-.143.276-.217a.055.055 0 01.058-.008c2.92 1.333 6.08 1.333 8.97 0a.055.055 0 01.058.007c.089.074.183.148.277.218a.057.057 0 01-.005.094c-.444.26-.91.48-1.393.662a.056.056 0 00-.03.08c.268.518.574 1.013.912 1.482a.056.056 0 00.063.022 14.76 14.76 0 004.464-2.254.057.057 0 00.023-.04c.388-4.014-.65-7.132-2.752-10.076a.045.045 0 00-.023-.02zM6.023 8.753c-.872 0-1.59-.8-1.59-1.784 0-.983.704-1.784 1.59-1.784.893 0 1.604.808 1.59 1.784 0 .984-.704 1.784-1.59 1.784zm5.88 0c-.872 0-1.59-.8-1.59-1.784 0-.983.704-1.784 1.59-1.784.893 0 1.604.808 1.59 1.784 0 .984-.697 1.784-1.59 1.784z"
                fill="#5865F2"
              />
            </svg>
            Continue with Discord
          </button>
        </div>

        {/* Sign in link */}
        <div style={styles.signInRow}>
          <span style={styles.signInText}>Already have an account?</span>
          <Link to="/login" style={styles.signInLink}>
            Sign in
          </Link>
        </div>
      </form>
    </div>
  );
}
