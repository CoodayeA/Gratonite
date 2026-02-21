import { useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { api, setAccessToken } from '@/lib/api';
import { useGuildsStore } from '@/stores/guilds.store';
import { useChannelsStore } from '@/stores/channels.store';
import { useMessagesStore } from '@/stores/messages.store';
import { onDeepLink, onNavigate } from '@/lib/desktop';
import { useUnreadBadge } from '@/hooks/useUnreadBadge';

// Layouts
import { AuthLayout } from '@/layouts/AuthLayout';
import { AppLayout } from '@/layouts/AppLayout';

// Guards
import { RequireAuth } from '@/components/guards/RequireAuth';
import { RequireGuest } from '@/components/guards/RequireGuest';

// Pages
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { HomePage } from '@/pages/HomePage';
import { GuildPage } from '@/pages/GuildPage';
import { ChannelPage } from '@/pages/ChannelPage';
import { InvitePage } from '@/pages/InvitePage';

// Loading
import { LoadingScreen } from '@/components/ui/LoadingScreen';

export function App() {
  const { isLoading, login, logout, setLoading } = useAuthStore();
  const navigate = useNavigate();
  useUnreadBadge();

  // Silent token refresh on app mount
  useEffect(() => {
    let cancelled = false;

    async function tryRefresh() {
      try {
        const token = await api.auth.refresh();
        if (cancelled) return;

        if (token) {
          setAccessToken(token);
          const me = await api.users.getMe();
          if (cancelled) return;

          login({
            id: me.id,
            username: me.username,
            email: me.email,
            displayName: me.profile.displayName,
            avatarHash: me.profile.avatarHash,
            tier: me.profile.tier,
          });
        } else {
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    tryRefresh();
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for desktop notification click-to-navigate events
  useEffect(() => {
    return onNavigate((route: string) => {
      navigate(route);
    });
  }, [navigate]);

  useEffect(() => {
    return onDeepLink((url) => {
      if (!url.startsWith('gratonite://')) return;
      const path = url.replace('gratonite://', '').replace(/^\//, '');
      const [route, ...rest] = path.split('/');
      if (route === 'invite' && rest[0]) {
        navigate(`/invite/${rest[0]}`);
      } else if (route === 'dm' && rest[0]) {
        navigate(`/dm/${rest[0]}`);
      } else if (route === 'guild' && rest[0] && rest[1] === 'channel' && rest[2]) {
        navigate(`/guild/${rest[0]}/channel/${rest[2]}`);
      }
    });
  }, [navigate]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      {/* Auth routes (guest only) */}
      <Route
        element={
          <RequireGuest>
            <AuthLayout />
          </RequireGuest>
        }
      >
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      {/* Invite page (works for both guest and auth) */}
      <Route path="/invite/:code" element={<InvitePage />} />

      {/* Authenticated routes */}
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<HomePage />} />
        <Route path="/guild/:guildId" element={<GuildPage />}>
          <Route path="channel/:channelId" element={<ChannelPage />} />
        </Route>
        <Route path="/dm/:channelId" element={<ChannelPage />} />
      </Route>
    </Routes>
  );
}
