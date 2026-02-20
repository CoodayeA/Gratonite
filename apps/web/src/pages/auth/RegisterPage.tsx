import { useState, useRef, useEffect, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api, setAccessToken, ApiRequestError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

export function RegisterPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');

  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameChecking, setUsernameChecking] = useState(false);
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
      if (err instanceof ApiRequestError) {
        setError(err.message);
        if (err.details) setFieldErrors(err.details);
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <h2 className="auth-heading">Create an account</h2>

      {error && <div className="auth-error">{error}</div>}

      <Input
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={fieldErrors.email?.[0]}
        required
        autoComplete="email"
        autoFocus
      />

      <Input
        label="Display Name"
        type="text"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        hint="This is how others see you. You can always change it later."
        error={fieldErrors.displayName?.[0]}
      />

      <Input
        label="Username"
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))}
        hint={getUsernameHint()}
        error={
          usernameAvailable === false
            ? 'Username is already taken'
            : fieldErrors.username?.[0]
        }
        required
        autoComplete="username"
      />

      <Input
        label="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        hint={password.length > 0 && password.length < 8 ? 'Must be at least 8 characters' : ''}
        error={fieldErrors.password?.[0]}
        required
        autoComplete="new-password"
        minLength={8}
      />

      <Input
        label="Date of Birth"
        type="date"
        value={dateOfBirth}
        onChange={(e) => setDateOfBirth(e.target.value)}
        error={fieldErrors.dateOfBirth?.[0]}
        required
      />

      <Button type="submit" loading={loading} className="auth-submit">
        Continue
      </Button>

      <p className="auth-link">
        <Link to="/login">Already have an account?</Link>
      </p>
    </form>
  );
}
