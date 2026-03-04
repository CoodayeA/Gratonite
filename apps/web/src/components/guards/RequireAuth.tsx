import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api, getAccessToken } from '../../lib/api';
import { useAuthRuntimeState } from '../../lib/authRuntime';

type AuthStatus = 'checking' | 'allowed' | 'denied';

const RequireAuth = ({ children }: { children: React.ReactNode }) => {
  const [status, setStatus] = useState<AuthStatus>('checking');
  const location = useLocation();
  const authRuntimeState = useAuthRuntimeState();

  useEffect(() => {
    if (import.meta.env.VITE_E2E_BYPASS_AUTH === '1') {
      setStatus('allowed');
      return;
    }

    if (authRuntimeState === 'expired') {
      setStatus('denied');
      return;
    }

    if (!getAccessToken()) {
      setStatus('denied');
      return;
    }

    api.users
      .getMe()
      .then(() => setStatus('allowed'))
      .catch(() => setStatus('denied'));
  }, [authRuntimeState]);

  if (status === 'checking') return null;
  if (status === 'denied') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
};

export default RequireAuth;
