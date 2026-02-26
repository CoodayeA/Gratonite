import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';

interface RequireAdminProps {
  children: React.ReactNode;
}

export function RequireAdmin({ children }: RequireAdminProps) {
  const isAdmin = useAuthStore((s) => s.user?.isAdmin);

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
