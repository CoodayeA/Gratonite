import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { api, getAccessToken, setAccessToken } from '@/lib/api';
import { mark, measure } from '@/lib/perf';
import { useGuildsStore } from '@/stores/guilds.store';
import { useChannelsStore } from '@/stores/channels.store';
import { useMessagesStore } from '@/stores/messages.store';
import { onDeepLink, onNavigate } from '@/lib/desktop';
import { useUnreadBadge } from '@/hooks/useUnreadBadge';

import { RequireAuth } from '@/components/guards/RequireAuth';
import { RequireGuest } from '@/components/guards/RequireGuest';

// Loading
import { LoadingScreen } from '@/components/ui/LoadingScreen';

const AuthLayout = lazy(() => import('@/layouts/AuthLayout').then((m) => ({ default: m.AuthLayout })));
const AppLayout = lazy(() => import('@/layouts/AppLayout').then((m) => ({ default: m.AppLayout })));
const LoginPage = lazy(() => import('@/pages/auth/LoginPage').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage').then((m) => ({ default: m.RegisterPage })));
const VerifyEmailPendingPage = lazy(() =>
  import('@/pages/auth/VerifyEmailPendingPage').then((m) => ({ default: m.VerifyEmailPendingPage })),
);
const VerifyEmailConfirmPage = lazy(() =>
  import('@/pages/auth/VerifyEmailConfirmPage').then((m) => ({ default: m.VerifyEmailConfirmPage })),
);
const CompleteAccountSetupPage = lazy(() =>
  import('@/pages/auth/CompleteAccountSetupPage').then((m) => ({ default: m.CompleteAccountSetupPage })),
);
const GuildPage = lazy(() => import('@/pages/GuildPage').then((m) => ({ default: m.GuildPage })));
const ChannelPage = lazy(() => import('@/pages/ChannelPage').then((m) => ({ default: m.ChannelPage })));
const InvitePage = lazy(() => import('@/pages/InvitePage').then((m) => ({ default: m.InvitePage })));
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const BlogPage = lazy(() => import('@/pages/BlogPage').then((m) => ({ default: m.BlogPage })));
const BugInboxPage = lazy(() => import('@/pages/BugInboxPage').then((m) => ({ default: m.BugInboxPage })));
const DiscoverPage = lazy(() => import('@/pages/DiscoverPage').then((m) => ({ default: m.DiscoverPage })));
const ShopPage = lazy(() => import('@/pages/ShopPage').then((m) => ({ default: m.ShopPage })));
const NotificationsPage = lazy(() => import('@/pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage })));
const FriendsPage = lazy(() => import('@/pages/FriendsPage').then((m) => ({ default: m.FriendsPage })));
const GratoniteDashboard = lazy(() => import('@/pages/GratoniteDashboard').then((m) => ({ default: m.GratoniteDashboard })));
const LeaderboardPage = lazy(() => import('@/pages/LeaderboardPage').then((m) => ({ default: m.LeaderboardPage })));
const AdminShopPage = lazy(() => import('@/pages/AdminShopPage').then((m) => ({ default: m.AdminShopPage })));
<<<<<<< HEAD
const PortalPreviewPage = lazy(() => import('@/pages/PortalPreviewPage').then((m) => ({ default: m.PortalPreviewPage })));
const AddFriendPage = lazy(() => import('@/pages/AddFriendPage').then((m) => ({ default: m.AddFriendPage })));
=======
const CreateEventPage = lazy(() => import('@/pages/CreateEventPage').then((m) => ({ default: m.CreateEventPage })));
>>>>>>> 9ee4fd6 (feat: US-036 - Web Events Creation Flow wizard)

export function App() {
  const { isLoading, isAuthenticated, login, logout, setLoading } = useAuthStore();
  const navigate = useNavigate();
  useUnreadBadge();

  // Silent token refresh on app mount
  useEffect(() => {
    let cancelled = false;

    async function tryRefresh() {
      try {
        const existingToken = getAccessToken();
        if (existingToken) {
          const me = await api.users.getMe();
          if (cancelled) return;
          login({
            id: me.id,
            username: me.username,
            email: me.email,
            displayName: me.profile.displayName,
            avatarHash: me.profile.avatarHash,
            avatarDecorationId: me.profile.avatarDecorationId ?? null,
            profileEffectId: me.profile.profileEffectId ?? null,
            nameplateId: me.profile.nameplateId ?? null,
            tier: me.profile.tier,
          });
          return;
        }

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
            avatarDecorationId: me.profile.avatarDecorationId ?? null,
            profileEffectId: me.profile.profileEffectId ?? null,
            nameplateId: me.profile.nameplateId ?? null,
            tier: me.profile.tier,
          });
          return;
        }

        setLoading(false);
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

  useEffect(() => {
    if (isLoading) return;
    mark('app_ready');
    measure('app_ready', 'app_start', 'app_ready');
  }, [isLoading]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/blog" element={<BlogPage />} />
        <Route path="/verify-email" element={<VerifyEmailConfirmPage />} />

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
          <Route path="/verify-email/pending" element={<VerifyEmailPendingPage />} />
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
          <Route path="/" element={<FriendsPage />} />
          <Route path="/onboarding/account" element={<CompleteAccountSetupPage />} />
          <Route path="/discover" element={<DiscoverPage />} />
          <Route path="/shop" element={<ShopPage />} />
          <Route path="/friends" element={<FriendsPage />} />
          <Route path="/gratonite" element={<GratoniteDashboard />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/portal/:guildId/preview" element={<PortalPreviewPage />} />
          <Route path="/guild/:guildId" element={<GuildPage />}>
            <Route path="channel/:channelId" element={<ChannelPage />} />
          </Route>
          <Route path="/guild/:guildId/events/create" element={<CreateEventPage />} />
          <Route path="/dm/:channelId" element={<ChannelPage />} />
          <Route path="/add-friend" element={<AddFriendPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/admin/shop" element={<AdminShopPage />} />
          <Route path="/ops/bugs" element={<BugInboxPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
