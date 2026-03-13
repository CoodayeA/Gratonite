import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Task #90: Handles navigation events from the Electron app menu bar.
 * Routes like /app/settings or /app/create-server are sent via IPC.
 */
export function useDesktopMenuNavigation() {
  const navigate = useNavigate();

  useEffect(() => {
    const desktop = window.gratoniteDesktop;
    if (!desktop?.isDesktop || !desktop.onNavigate) return;

    const unsub = desktop.onNavigate((route: string) => {
      // Strip /app prefix if present since web routes don't include it
      const cleanRoute = route.replace(/^\/app/, '') || '/';
      navigate(cleanRoute);
    });

    return unsub;
  }, [navigate]);
}
