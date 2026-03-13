import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Task #86: Handles gratonite:// deep links from the desktop app.
 * Parses the URL and navigates to the appropriate route.
 */
export function useDesktopDeepLinks() {
  const navigate = useNavigate();

  useEffect(() => {
    const desktop = window.gratoniteDesktop;
    if (!desktop?.isDesktop || !desktop.onDeepLink) return;

    const unsub = desktop.onDeepLink((url: string) => {
      try {
        // Parse gratonite:// URLs
        const parsed = new URL(url);
        const pathParts = parsed.pathname.replace(/^\/+/, '').split('/');

        if (parsed.host === 'guild' || pathParts[0] === 'guild') {
          const parts = parsed.host === 'guild' ? parsed.pathname.replace(/^\/+/, '').split('/') : pathParts.slice(1);
          const guildId = parts[0];
          if (parts[1] === 'channel' && parts[2]) {
            navigate(`/guild/${guildId}/channel/${parts[2]}`);
          } else if (guildId) {
            navigate(`/guild/${guildId}`);
          }
        } else if (parsed.host === 'dm' || pathParts[0] === 'dm') {
          const userId = parsed.host === 'dm' ? parsed.pathname.replace(/^\/+/, '') : pathParts[1];
          if (userId) navigate(`/dm/${userId}`);
        } else if (parsed.host === 'invite' || pathParts[0] === 'invite') {
          const code = parsed.host === 'invite' ? parsed.pathname.replace(/^\/+/, '') : pathParts[1];
          if (code) navigate(`/invite/${code}`);
        } else if (parsed.host === 'settings' || pathParts[0] === 'settings') {
          navigate('/settings');
        }
      } catch {
        // Invalid URL — ignore
      }
    });

    return unsub;
  }, [navigate]);
}
