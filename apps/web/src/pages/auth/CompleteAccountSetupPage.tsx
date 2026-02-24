import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api, ApiRequestError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { getErrorMessage } from '@/lib/utils';

export function CompleteAccountSetupPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);

  const [username, setUsername] = useState(user?.username ?? '');
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);

  const usernameTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setUsernameAvailable(null);
    if (!username || username.length < 2) return;
    if (user?.username?.toLowerCase() === username.toLowerCase()) {
      setUsernameAvailable(true);
      return;
    }

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
    }, 400);

    return () => clearTimeout(usernameTimer.current);
  }, [username, user?.username]);

  function getUsernameHint() {
    if (usernameChecking) return 'Checking availability...';
    if (usernameAvailable === true) return 'Username is available';
    if (usernameAvailable === false) return 'Username is already taken';
    return 'Use letters, numbers, period, underscore, or dash';
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    if (usernameAvailable === false) {
      setError('Please choose a different username.');
      return;
    }

    setLoading(true);
    try {
      const fallbackDisplayName = displayName || username;
      const res = await api.users.updateAccountBasics({
        username,
        displayName: fallbackDisplayName,
      });

      updateUser({
        username: res.user.username,
        displayName: res.profile?.displayName ?? fallbackDisplayName,
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

  if (!user) {
    return (
      <div className="auth-form">
        <h2 className="auth-heading">Sign in required</h2>
        <p className="auth-subheading">Please sign in to complete account setup.</p>
        <Link to="/login" className="auth-button-link">
          <Button className="auth-submit">Go to Login</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="auth-form">
      <h2 className="auth-heading">Complete account setup</h2>
      <p className="auth-subheading">
        Choose how your account appears before entering the app.
      </p>

      {error && <div className="auth-error">{error}</div>}

      <form className="auth-form auth-form-nested" onSubmit={handleSubmit}>
        <Input
          label="Display Name"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          error={fieldErrors['displayName']?.[0]}
          hint="This is how people see you in chats and profiles."
        />

        <Input
          label="Username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))}
          error={
            usernameAvailable === false ? 'Username is already taken' : fieldErrors['username']?.[0]
          }
          hint={getUsernameHint()}
          required
          autoComplete="username"
        />

        <Button type="submit" loading={loading} className="auth-submit">
          Continue to App
        </Button>
      </form>

      <p className="auth-link">
        <Link to="/">Skip for now</Link>
      </p>
    </div>
  );
}
