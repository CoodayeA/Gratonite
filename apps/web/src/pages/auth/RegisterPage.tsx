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
