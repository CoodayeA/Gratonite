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
import { useCosmeticsStore } from '@/stores/cosmetics.store';

import { RequireAuth } from '@/components/guards/RequireAuth';
import { RequireGuest } from '@/components/guards/RequireGuest';
import { RequireAdmin } from '@/components/guards/RequireAdmin';
import { ErrorBoundary } from '@/components/ErrorBoundary';

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

// New Feature Pages (Phase 3)
const WikiPage = lazy(() => import('@/pages/WikiPage').then((m) => ({ default: m.WikiPage })));
const EventsPage = lazy(() => import('@/pages/EventsPage').then((m) => ({ default: m.EventsPage })));
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })));
const BotsPage = lazy(() => import('@/pages/BotsPage').then((m) => ({ default: m.BotsPage })));
const ThemesPage = lazy(() => import('@/pages/ThemesPage').then((m) => ({ default: m.ThemesPage })));
const PollsPage = lazy(() => import('@/pages/PollsPage').then((m) => ({ default: m.PollsPage })));
const QAPage = lazy(() => import('@/pages/QAPage').then((m) => ({ default: m.QAPage })));
const ScheduledMsgsPage = lazy(() => import('@/pages/ScheduledMsgsPage').then((m) => ({ default: m.ScheduledMsgsPage })));
const AutoModPage = lazy(() => import('@/pages/AutoModPage').then((m) => ({ default: m.AutoModPage })));
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
const HomePage = lazy(() => import('@/pages/HomePage').then((m) => ({ default: m.HomePage })));
const GratoniteDashboard = lazy(() => import('@/pages/GratoniteDashboard').then((m) => ({ default: m.GratoniteDashboard })));
const LeaderboardPage = lazy(() => import('@/pages/LeaderboardPage').then((m) => ({ default: m.LeaderboardPage })));
const AdminShopPage = lazy(() => import('@/pages/AdminShopPage').then((m) => ({ default: m.AdminShopPage })));
const PortalPreviewPage = lazy(() => import('@/pages/PortalPreviewPage').then((m) => ({ default: m.PortalPreviewPage })));
const UserProfilePage = lazy(() => import('@/pages/UserProfilePage').then((m) => ({ default: m.UserProfilePage })));
const ShopItemDetailPage = lazy(() => import('@/pages/ShopItemDetailPage').then((m) => ({ default: m.ShopItemDetailPage })));
const AddFriendPage = lazy(() => import('@/pages/AddFriendPage').then((m) => ({ default: m.AddFriendPage })));
const SoundboardPage = lazy(() => import('@/pages/SoundboardPage').then((m) => ({ default: m.SoundboardPage })));
const CreateEventPage = lazy(() => import('@/pages/CreateEventPage').then((m) => ({ default: m.CreateEventPage })));
const GratoniteGuysLabPage = lazy(() => import('@/pages/GratoniteGuysLabPage').then((m) => ({ default: m.GratoniteGuysLabPage })));
const LandingPage = lazy(() => import('@/pages/LandingPage').then((m) => ({ default: m.LandingPage })));
const EventDetailPage = lazy(() => import('@/pages/EventDetailPage').then((m) => ({ default: m.EventDetailPage })));
const VoiceMessagesPage = lazy(() => import('@/pages/VoiceMessagesPage').then((m) => ({ default: m.VoiceMessagesPage })));
const CreateBotPage = lazy(() => import('@/pages/CreateBotPage').then((m) => ({ default: m.CreateBotPage })));
const MultiScreenSharePage = lazy(() => import('@/pages/MultiScreenSharePage').then((m) => ({ default: m.MultiScreenSharePage })));
const ThemeMakerPage = lazy(() => import('@/pages/ThemeMakerPage').then((m) => ({ default: m.ThemeMakerPage })));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));
const CreatorDashboardPage = lazy(() => import('@/pages/CreatorDashboardPage').then((m) => ({ default: m.CreatorDashboardPage })));
const CosmeticsMarketplacePage = lazy(() => import('@/pages/CosmeticsMarketplacePage').then((m) => ({ default: m.CosmeticsMarketplacePage })));
const CosmeticsInventoryPage = lazy(() => import('@/pages/CosmeticsInventoryPage').then((m) => ({ default: m.CosmeticsInventoryPage })));
const CreatorShopPage = lazy(() => import('@/pages/CreatorShopPage').then((m) => ({ default: m.CreatorShopPage })));

export function App() {
  const { isLoading, isAuthenticated, login, logout, setLoading } = useAuthStore();
  const navigate = useNavigate();
  const loadEquipped = useCosmeticsStore((s) => s.loadEquipped);
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
            displayName: me.profile?.displayName ?? me.username,
            avatarHash: me.profile?.avatarHash ?? null,
            avatarDecorationId: me.profile?.avatarDecorationId ?? null,
            profileEffectId: me.profile?.profileEffectId ?? null,
            nameplateId: me.profile?.nameplateId ?? null,
            tier: me.profile?.tier ?? 'free',
            isAdmin: me.isAdmin ?? false,
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
            displayName: me.profile?.displayName ?? me.username,
            avatarHash: me.profile?.avatarHash ?? null,
            avatarDecorationId: me.profile?.avatarDecorationId ?? null,
            profileEffectId: me.profile?.profileEffectId ?? null,
            nameplateId: me.profile?.nameplateId ?? null,
            tier: me.profile?.tier ?? 'free',
            isAdmin: me.isAdmin ?? false,
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

  useEffect(() => {
    if (isAuthenticated) loadEquipped();
  }, [isAuthenticated, loadEquipped]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/blog" element={<BlogPage />} />
        <Route path="/landing" element={<LandingPage />} />
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
              <ErrorBoundary>
                <AppLayout />
              </ErrorBoundary>
            </RequireAuth>
          }
        >
          <Route path="/" element={<HomePage />} />
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
          <Route path="/dm/:channelId" element={<ChannelPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/admin/shop" element={<RequireAdmin><AdminShopPage /></RequireAdmin>} />
          <Route path="/ops/bugs" element={<RequireAdmin><BugInboxPage /></RequireAdmin>} />
          
          {/* Phase 3: New Feature Pages */}
          <Route path="/wiki/:guildId/:channelId" element={<WikiPage />} />
          <Route path="/events/:guildId" element={<EventsPage />} />
          <Route path="/analytics/:guildId" element={<RequireAdmin><AnalyticsPage /></RequireAdmin>} />
          <Route path="/bots" element={<BotsPage />} />
          <Route path="/themes" element={<ThemesPage />} />
          <Route path="/themes/create" element={<ThemeMakerPage />} />
          <Route path="/themes/:id/edit" element={<ThemeMakerPage />} />
          <Route path="/polls" element={<PollsPage />} />
          <Route path="/qa/:guildId/:channelId" element={<QAPage />} />
          <Route path="/scheduled-messages/:guildId" element={<ScheduledMsgsPage />} />
          <Route path="/automod/:guildId" element={<RequireAdmin><AutoModPage /></RequireAdmin>} />
          <Route path="/profile/:userId" element={<UserProfilePage />} />
          <Route path="/shop/:itemId" element={<ShopItemDetailPage />} />
          <Route path="/add-friend" element={<AddFriendPage />} />

          {/* Missing pages — now wired */}
          <Route path="/soundboard/:guildId" element={<SoundboardPage />} />
          <Route path="/events/:guildId/create" element={<CreateEventPage />} />
          <Route path="/events/:guildId/:eventId" element={<EventDetailPage />} />
          <Route path="/voice-messages/:guildId/:channelId" element={<VoiceMessagesPage />} />
          <Route path="/create-bot/:guildId" element={<CreateBotPage />} />
          <Route path="/screen-share/:guildId/:channelId" element={<MultiScreenSharePage />} />
          <Route path="/gratonite-guys-lab" element={<GratoniteGuysLabPage />} />

          {/* Creator Marketplace */}
          <Route path="/cosmetics" element={<CosmeticsMarketplacePage />} />
          <Route path="/cosmetics/inventory" element={<CosmeticsInventoryPage />} />
          <Route path="/creator/dashboard" element={<CreatorDashboardPage />} />
          <Route path="/creator/:creatorId" element={<CreatorShopPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
