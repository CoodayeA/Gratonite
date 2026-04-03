import React from 'react';
import { View, Text, Platform, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import ErrorBoundary from '../components/ErrorBoundary';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAppState } from '../contexts/AppStateContext';
import { useTheme } from '../lib/theme';
import { selectionFeedback } from '../lib/haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import VoiceBar from '../components/VoiceBar';
import type { AppStackParamList, AppTabParamList } from './types';

// Tab screens
import GuildListScreen from '../screens/app/GuildListScreen';
import DMListScreen from '../screens/app/DMListScreen';
import FriendsScreen from '../screens/app/FriendsScreen';
import NotificationInboxScreen from '../screens/app/NotificationInboxScreen';

// Existing stack screens
import DirectMessageScreen from '../screens/app/DirectMessageScreen';
import CreateGuildScreen from '../screens/app/CreateGuildScreen';
import GuildSettingsScreen from '../screens/guild/GuildSettingsScreen';
import GuildMemberListScreen from '../screens/guild/GuildMemberListScreen';
import InviteAcceptScreen from '../screens/app/InviteAcceptScreen';
import GuildDrawerNavigator from './GuildDrawerNavigator';
import GuildChannelsScreen from '../screens/guild/GuildChannelsScreen';
import ChannelChatScreen from '../screens/guild/ChannelChatScreen';
import VoiceChannelScreen from '../screens/guild/VoiceChannelScreen';

// Wave 2: User system
import UserProfileScreen from '../screens/app/UserProfileScreen';
import SettingsScreen from '../screens/app/SettingsScreen';
import SettingsAccountScreen from '../screens/app/SettingsAccountScreen';
import SettingsAppearanceScreen from '../screens/app/SettingsAppearanceScreen';
import SettingsNotificationsScreen from '../screens/app/SettingsNotificationsScreen';
import SettingsPrivacyScreen from '../screens/app/SettingsPrivacyScreen';
import SettingsSessionsScreen from '../screens/app/SettingsSessionsScreen';
import SettingsMutedUsersScreen from '../screens/app/SettingsMutedUsersScreen';

// Wave 3: Social & DMs
import GroupDMCreateScreen from '../screens/app/GroupDMCreateScreen';
import GroupDMSettingsScreen from '../screens/app/GroupDMSettingsScreen';
import DMSearchScreen from '../screens/app/DMSearchScreen';
import FriendAddScreen from '../screens/app/FriendAddScreen';
import MessageRequestsScreen from '../screens/app/MessageRequestsScreen';

// Wave 4: Server management
import RoleListScreen from '../screens/guild/RoleListScreen';
import RoleEditScreen from '../screens/guild/RoleEditScreen';
import ChannelCreateScreen from '../screens/guild/ChannelCreateScreen';
import ChannelEditScreen from '../screens/guild/ChannelEditScreen';
import InviteListScreen from '../screens/guild/InviteListScreen';
import MemberModerateScreen from '../screens/guild/MemberModerateScreen';

// Wave 5: Content types
import ThreadViewScreen from '../screens/guild/ThreadViewScreen';
import ThreadListScreen from '../screens/guild/ThreadListScreen';
import BookmarksScreen from '../screens/app/BookmarksScreen';
import GlobalSearchScreen from '../screens/app/GlobalSearchScreen';

// Wave 6: Discovery & organization
import ServerDiscoverScreen from '../screens/app/ServerDiscoverScreen';
import ServerFoldersScreen from '../screens/app/ServerFoldersScreen';
import ScheduledEventsScreen from '../screens/guild/ScheduledEventsScreen';
import EventDetailScreen from '../screens/guild/EventDetailScreen';
import EventCreateScreen from '../screens/guild/EventCreateScreen';
import GuildInsightsScreen from '../screens/guild/GuildInsightsScreen';

// Wave 7: Economy & cosmetics
import ShopScreen from '../screens/app/ShopScreen';
import InventoryScreen from '../screens/app/InventoryScreen';
import WalletScreen from '../screens/app/WalletScreen';

// Wave 8: Advanced features
import ForumChannelScreen from '../screens/guild/ForumChannelScreen';
import WikiChannelScreen from '../screens/guild/WikiChannelScreen';
import AnnouncementChannelScreen from '../screens/guild/AnnouncementChannelScreen';
import AuditLogScreen from '../screens/guild/AuditLogScreen';
import WebhookManagementScreen from '../screens/guild/WebhookManagementScreen';
import BanAppealsScreen from '../screens/guild/BanAppealsScreen';
import WordFilterScreen from '../screens/guild/WordFilterScreen';
import RaidProtectionScreen from '../screens/guild/RaidProtectionScreen';

// Wave B: Chat enhancements
import RemindersScreen from '../screens/app/RemindersScreen';

// Wave C: Social & guild features
import LeaderboardScreen from '../screens/guild/LeaderboardScreen';
import GiveawayListScreen from '../screens/guild/GiveawayListScreen';
import QuestBoardScreen from '../screens/guild/QuestBoardScreen';
import ConfessionBoardScreen from '../screens/guild/ConfessionBoardScreen';
import GreetingCardsScreen from '../screens/app/GreetingCardsScreen';
import PhotoAlbumsScreen from '../screens/guild/PhotoAlbumsScreen';
import TicketListScreen from '../screens/guild/TicketListScreen';
import StarboardScreen from '../screens/guild/StarboardScreen';

// Wave D: Guild admin
import OnboardingConfigScreen from '../screens/guild/OnboardingConfigScreen';
import StarboardConfigScreen from '../screens/guild/StarboardConfigScreen';
import AutoRoleConfigScreen from '../screens/guild/AutoRoleConfigScreen';
import DigestConfigScreen from '../screens/guild/DigestConfigScreen';
import ActivityLogScreen from '../screens/guild/ActivityLogScreen';

// Wave E: New channel types + marketplace
import TimelineChannelScreen from '../screens/guild/TimelineChannelScreen';
import QAChannelScreen from '../screens/guild/QAChannelScreen';
import MarketplaceScreen from '../screens/app/MarketplaceScreen';

// Wave F: Tier 2 admin
import ReactionRoleConfigScreen from '../screens/guild/ReactionRoleConfigScreen';
import WorkflowListScreen from '../screens/guild/WorkflowListScreen';

// Wave G: App Store Readiness
import GuildBansScreen from '../screens/guild/GuildBansScreen';
import EmojiManagementScreen from '../screens/guild/EmojiManagementScreen';
import AutomodConfigScreen from '../screens/guild/AutomodConfigScreen';
import ServerTemplatesScreen from '../screens/guild/ServerTemplatesScreen';
import MFASetupScreen from '../screens/app/MFASetupScreen';
import SettingsAppLockScreen from '../screens/app/SettingsAppLockScreen';
import SettingsSoundScreen from '../screens/app/SettingsSoundScreen';
import FeedbackScreen from '../screens/app/FeedbackScreen';
import AchievementsScreen from '../screens/app/AchievementsScreen';
import CosmeticsScreen from '../screens/app/CosmeticsScreen';
import ActivityFeedScreen from '../screens/app/ActivityFeedScreen';
import UserStatsScreen from '../screens/app/UserStatsScreen';
import BotStoreScreen from '../screens/app/BotStoreScreen';
import SettingsSecurityScreen from '../screens/app/SettingsSecurityScreen';
import SettingsServerScreen from '../screens/app/SettingsServerScreen';
import KeyVerificationScreen from '../screens/app/KeyVerificationScreen';
import FederationScreen from '../screens/app/FederationScreen';

// Wave H: Feature Enhancement
import MusicRoomScreen from '../screens/guild/MusicRoomScreen';
import StudyRoomScreen from '../screens/guild/StudyRoomScreen';
import StudyLeaderboardScreen from '../screens/guild/StudyLeaderboardScreen';
import StageChannelScreen from '../screens/guild/StageChannelScreen';
import AuctionsScreen from '../screens/app/AuctionsScreen';
import AuctionDetailScreen from '../screens/app/AuctionDetailScreen';
import CreateAuctionScreen from '../screens/app/CreateAuctionScreen';
import GuildFormsScreen from '../screens/guild/GuildFormsScreen';
import FormFillScreen from '../screens/guild/FormFillScreen';
import FormResponsesScreen from '../screens/guild/FormResponsesScreen';
import FormCreateScreen from '../screens/guild/FormCreateScreen';
import ConnectionsScreen from '../screens/app/ConnectionsScreen';
import InterestTagsScreen from '../screens/app/InterestTagsScreen';
import InterestMatchesScreen from '../screens/guild/InterestMatchesScreen';
import SeasonalEventsScreen from '../screens/app/SeasonalEventsScreen';
import ClipsScreen from '../screens/guild/ClipsScreen';
import HelpCenterScreen from '../screens/app/HelpCenterScreen';
import HelpArticleScreen from '../screens/app/HelpArticleScreen';
import FameDashboardScreen from '../screens/app/FameDashboardScreen';
import CommandPaletteScreen from '../screens/app/CommandPaletteScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';

const Tab = createBottomTabNavigator<AppTabParamList>();
const Stack = createNativeStackNavigator<AppStackParamList>();

function MainTabs() {
  const insets = useSafeAreaInsets();
  const { notificationCount } = useAppState();
  const { colors, fontSize, neo, glass } = useTheme();

  const iosGlassTabBar = Boolean(glass && Platform.OS === 'ios');

  const tabBarBackground = React.useCallback(() => {
    if (!iosGlassTabBar || !glass) return undefined;
    return (
      <BlurView
        intensity={Math.min(glass.blurIntensity + 12, 90)}
        tint={glass.blurTint}
        style={StyleSheet.absoluteFill}
      />
    );
  }, [glass, iosGlassTabBar]);

  return (
    <View style={{ flex: 1 }}>
    <Tab.Navigator
      screenListeners={{
        tabPress: () => selectionFeedback(),
      }}
      screenOptions={{
        headerShown: false,
        tabBarBackground,
        tabBarStyle: {
          backgroundColor: iosGlassTabBar
            ? 'transparent'
            : glass
              ? glass.glassBackground
              : colors.bgSecondary,
          borderTopColor: neo ? colors.border : glass ? glass.glassBorder : colors.accentPrimary,
          borderTopWidth: neo ? 3 : glass ? 0.5 : 1,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 6,
          shadowColor: '#000',
          shadowOpacity: iosGlassTabBar ? 0.06 : 0.1,
          shadowOffset: { width: 0, height: -2 },
          shadowRadius: iosGlassTabBar ? 8 : 4,
          elevation: 8,
        },
        tabBarActiveTintColor: colors.accentPrimary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIconStyle: {
          marginBottom: 2,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: neo ? '800' : '600',
          ...(neo ? { textTransform: 'uppercase' as const } : {}),
        },
      }}
    >
      <Tab.Screen
        name="Guilds"
        component={GuildListScreen}
        options={{
          tabBarLabel: 'Portals',
          tabBarAccessibilityLabel: 'Portals tab',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              {focused && (
                <View style={{
                  position: 'absolute',
                  width: 48,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: neo ? neo.palette.sky : `${colors.accentPrimary}20`,
                  ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}),
                }} />
              )}
              <Ionicons name={focused ? 'planet' : 'planet-outline'} size={focused ? 24 : 20} color={color} />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="DMs"
        component={DMListScreen}
        options={{
          tabBarLabel: 'Chats',
          tabBarAccessibilityLabel: 'Chats tab',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              {focused && (
                <View style={{
                  position: 'absolute',
                  width: 48,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: neo ? neo.palette.mint : `${colors.accentPrimary}20`,
                  ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}),
                }} />
              )}
              <Ionicons name={focused ? 'chatbubbles' : 'chatbubbles-outline'} size={focused ? 24 : 20} color={color} />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Friends"
        component={FriendsScreen}
        options={{
          tabBarLabel: 'Friends',
          tabBarAccessibilityLabel: 'Friends tab',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              {focused && (
                <View style={{
                  position: 'absolute',
                  width: 48,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: neo ? neo.palette.lavender : `${colors.accentPrimary}20`,
                  ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}),
                }} />
              )}
              <Ionicons name={focused ? 'people' : 'people-outline'} size={focused ? 24 : 20} color={color} />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationInboxScreen}
        options={{
          tabBarLabel: 'Alerts',
          tabBarAccessibilityLabel: 'Alerts tab',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              {focused && (
                <View style={{
                  position: 'absolute',
                  width: 48,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: neo ? neo.palette.coral : `${colors.accentPrimary}20`,
                  ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}),
                }} />
              )}
              <Ionicons name={focused ? 'notifications' : 'notifications-outline'} size={focused ? 24 : 20} color={color} />
            </View>
          ),
          tabBarBadge: notificationCount > 0 ? (notificationCount > 99 ? '99+' : notificationCount) : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.error,
            fontSize: 10,
            minWidth: 18,
            height: 18,
            lineHeight: 18,
          },
        }}
      />
    </Tab.Navigator>
    <View style={{ zIndex: 1 }}>
      <VoiceBar />
    </View>
    </View>
  );
}

export default function AppNavigator() {
  const { colors, neo, glass } = useTheme();

  const defaultStackOpts = React.useMemo(() => ({
    headerStyle: {
      backgroundColor: glass ? glass.glassBackground : colors.bgSecondary,
      ...(neo ? { borderBottomWidth: 3, borderBottomColor: colors.border } : {}),
    },
    headerTintColor: colors.textPrimary,
    headerTitleStyle: {
      fontWeight: neo ? '800' as const : '600' as const,
      ...(neo ? { textTransform: 'uppercase' as const } : {}),
    },
    contentStyle: { backgroundColor: colors.bgPrimary },
  }), [colors, neo, glass]);

  return (
    <ErrorBoundary>
    <Stack.Navigator screenOptions={defaultStackOpts}>
      <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
      <Stack.Screen name="GuildDrawer" component={GuildDrawerNavigator} options={{ headerShown: false }} />
      <Stack.Screen name="GuildChannels" component={GuildChannelsScreen} options={({ route }) => ({ title: route.params.guildName })} />
      <Stack.Screen name="ChannelChat" component={ChannelChatScreen} options={({ route }) => ({ title: `#${route.params.channelName}` })} />
      <Stack.Screen name="VoiceChannel" component={VoiceChannelScreen} options={({ route }) => ({ title: route.params.channelName })} />
      <Stack.Screen name="DirectMessage" component={DirectMessageScreen} options={({ route }) => ({ title: route.params.recipientName })} />
      <Stack.Screen name="CreateGuild" component={CreateGuildScreen} options={{ title: 'Create Portal' }} />
      <Stack.Screen name="GuildSettings" component={GuildSettingsScreen} options={({ route }) => ({ title: `${route.params.guildName} Settings` })} />
      <Stack.Screen name="GuildMemberList" component={GuildMemberListScreen} options={{ title: 'Members' }} />
      <Stack.Screen name="InviteAccept" component={InviteAcceptScreen} options={{ title: 'Portal Invite' }} />

      {/* Wave 2: User system */}
      <Stack.Screen name="UserProfile" component={UserProfileScreen} options={{ title: 'Profile' }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
      <Stack.Screen name="SettingsAccount" component={SettingsAccountScreen} options={{ title: 'Account' }} />
      <Stack.Screen name="SettingsAppearance" component={SettingsAppearanceScreen} options={{ title: 'Appearance' }} />
      <Stack.Screen name="SettingsNotifications" component={SettingsNotificationsScreen} options={{ title: 'Notifications' }} />
      <Stack.Screen name="SettingsPrivacy" component={SettingsPrivacyScreen} options={{ title: 'Privacy' }} />
      <Stack.Screen name="SettingsSessions" component={SettingsSessionsScreen} options={{ title: 'Sessions' }} />
      <Stack.Screen name="SettingsMutedUsers" component={SettingsMutedUsersScreen} options={{ title: 'Muted Users' }} />

      {/* Wave 3: Social & DMs */}
      <Stack.Screen name="GroupDMCreate" component={GroupDMCreateScreen} options={{ title: 'New Group' }} />
      <Stack.Screen name="GroupDMSettings" component={GroupDMSettingsScreen} options={{ title: 'Group Settings' }} />
      <Stack.Screen name="DMSearch" component={DMSearchScreen} options={{ title: 'Find User' }} />
      <Stack.Screen name="FriendAdd" component={FriendAddScreen} options={{ title: 'Add Friend' }} />
      <Stack.Screen name="MessageRequests" component={MessageRequestsScreen} options={{ title: 'Message Requests' }} />

      {/* Wave 4: Server management */}
      <Stack.Screen name="RoleList" component={RoleListScreen} options={{ title: 'Roles' }} />
      <Stack.Screen name="RoleEdit" component={RoleEditScreen} options={({ route }) => ({ title: route.params.roleId ? 'Edit Role' : 'Create Role' })} />
      <Stack.Screen name="ChannelCreate" component={ChannelCreateScreen} options={{ title: 'Create Channel' }} />
      <Stack.Screen name="ChannelEdit" component={ChannelEditScreen} options={{ title: 'Edit Channel' }} />
      <Stack.Screen name="InviteList" component={InviteListScreen} options={{ title: 'Invites' }} />
      <Stack.Screen name="MemberModerate" component={MemberModerateScreen} options={({ route }) => ({ title: route.params.username })} />

      {/* Wave 5: Content types */}
      <Stack.Screen name="ThreadView" component={ThreadViewScreen} options={({ route }) => ({ title: route.params.threadName })} />
      <Stack.Screen name="ThreadList" component={ThreadListScreen} options={({ route }) => ({ title: `Threads - ${route.params.channelName}` })} />
      <Stack.Screen name="Bookmarks" component={BookmarksScreen} options={{ title: 'Saved Messages' }} />
      <Stack.Screen name="GlobalSearch" component={GlobalSearchScreen} options={{ title: 'Search' }} />

      {/* Wave 6: Discovery & organization */}
      <Stack.Screen name="ServerDiscover" component={ServerDiscoverScreen} options={{ title: 'Discover Portals' }} />
      <Stack.Screen name="ServerFolders" component={ServerFoldersScreen} options={{ title: 'Portal Folders' }} />
      <Stack.Screen name="ScheduledEvents" component={ScheduledEventsScreen} options={{ title: 'Events' }} />
      <Stack.Screen name="EventDetail" component={EventDetailScreen} options={{ title: 'Event' }} />
      <Stack.Screen name="EventCreate" component={EventCreateScreen} options={({ route }) => ({ title: route.params.eventId ? 'Edit Event' : 'Create Event' })} />
      <Stack.Screen name="GuildInsights" component={GuildInsightsScreen} options={{ title: 'Portal Insights' }} />

      {/* Wave 7: Economy & cosmetics */}
      <Stack.Screen name="Shop" component={ShopScreen} options={{ title: 'Shop' }} />
      <Stack.Screen name="Inventory" component={InventoryScreen} options={{ title: 'Inventory' }} />
      <Stack.Screen name="Wallet" component={WalletScreen} options={{ title: 'Wallet' }} />

      {/* Wave 8: Advanced features */}
      <Stack.Screen name="ForumChannel" component={ForumChannelScreen} options={({ route }) => ({ title: route.params.channelName })} />
      <Stack.Screen name="WikiChannel" component={WikiChannelScreen} options={({ route }) => ({ title: route.params.channelName })} />
      <Stack.Screen name="AnnouncementChannel" component={AnnouncementChannelScreen} options={({ route }) => ({ title: route.params.channelName })} />
      <Stack.Screen name="AuditLog" component={AuditLogScreen} options={{ title: 'Audit Log' }} />
      <Stack.Screen name="WebhookManagement" component={WebhookManagementScreen} options={{ title: 'Webhooks' }} />
      <Stack.Screen name="BanAppeals" component={BanAppealsScreen} options={{ title: 'Ban Appeals' }} />
      <Stack.Screen name="WordFilterScreen" component={WordFilterScreen} options={{ title: 'Word Filter' }} />
      <Stack.Screen name="RaidProtection" component={RaidProtectionScreen} options={{ title: 'Raid Protection' }} />

      {/* Wave B: Chat enhancements */}
      <Stack.Screen name="Reminders" component={RemindersScreen} options={{ title: 'Reminders' }} />

      {/* Wave C: Social & guild features */}
      <Stack.Screen name="Leaderboard" component={LeaderboardScreen} options={{ title: 'Leaderboard' }} />
      <Stack.Screen name="GiveawayList" component={GiveawayListScreen} options={{ title: 'Giveaways' }} />
      <Stack.Screen name="QuestBoard" component={QuestBoardScreen} options={{ title: 'Quests' }} />
      <Stack.Screen name="ConfessionBoard" component={ConfessionBoardScreen} options={{ title: 'Confessions' }} />
      <Stack.Screen name="GreetingCards" component={GreetingCardsScreen} options={{ title: 'Greeting Cards' }} />
      <Stack.Screen name="PhotoAlbums" component={PhotoAlbumsScreen} options={{ title: 'Photo Albums' }} />
      <Stack.Screen name="TicketList" component={TicketListScreen} options={{ title: 'Tickets' }} />
      <Stack.Screen name="Starboard" component={StarboardScreen} options={{ title: 'Starboard' }} />

      {/* Wave D: Guild admin */}
      <Stack.Screen name="OnboardingConfig" component={OnboardingConfigScreen} options={{ title: 'Onboarding' }} />
      <Stack.Screen name="StarboardConfig" component={StarboardConfigScreen} options={{ title: 'Starboard Settings' }} />
      <Stack.Screen name="AutoRoleConfig" component={AutoRoleConfigScreen} options={{ title: 'Auto Roles' }} />
      <Stack.Screen name="DigestConfig" component={DigestConfigScreen} options={{ title: 'Digest Settings' }} />
      <Stack.Screen name="ActivityLog" component={ActivityLogScreen} options={{ title: 'Activity Log' }} />

      {/* Wave E: New channel types + marketplace */}
      <Stack.Screen name="TimelineChannel" component={TimelineChannelScreen} options={({ route }) => ({ title: route.params.channelName })} />
      <Stack.Screen name="QAChannel" component={QAChannelScreen} options={({ route }) => ({ title: route.params.channelName })} />
      <Stack.Screen name="Marketplace" component={MarketplaceScreen} options={{ title: 'Marketplace' }} />

      {/* Wave F: Tier 2 admin */}
      <Stack.Screen name="ReactionRoleConfig" component={ReactionRoleConfigScreen} options={{ title: 'Reaction Roles' }} />
      <Stack.Screen name="WorkflowList" component={WorkflowListScreen} options={{ title: 'Workflows' }} />

      {/* Wave G: App Store Readiness */}
      <Stack.Screen name="GuildBans" component={GuildBansScreen} options={{ title: 'Bans' }} />
      <Stack.Screen name="EmojiManagement" component={EmojiManagementScreen} options={{ title: 'Custom Emojis' }} />
      <Stack.Screen name="AutomodConfig" component={AutomodConfigScreen} options={{ title: 'Automod' }} />
      <Stack.Screen name="ServerTemplates" component={ServerTemplatesScreen} options={{ title: 'Templates' }} />
      <Stack.Screen name="MFASetup" component={MFASetupScreen} options={{ title: 'Two-Factor Auth' }} />
      <Stack.Screen name="SettingsAppLock" component={SettingsAppLockScreen} options={{ title: 'App Lock' }} />
      <Stack.Screen name="SettingsSound" component={SettingsSoundScreen} options={{ title: 'Sound' }} />
      <Stack.Screen name="Feedback" component={FeedbackScreen} options={{ title: 'Feedback' }} />
      <Stack.Screen name="Achievements" component={AchievementsScreen} options={{ title: 'Achievements' }} />
      <Stack.Screen name="Cosmetics" component={CosmeticsScreen} options={{ title: 'Wardrobe' }} />
      <Stack.Screen name="ActivityFeed" component={ActivityFeedScreen} options={{ title: 'Activity' }} />
      <Stack.Screen name="UserStats" component={UserStatsScreen} options={{ title: 'Platform Stats' }} />
      <Stack.Screen name="BotStore" component={BotStoreScreen} options={{ title: 'Bot Store' }} />
      <Stack.Screen name="SettingsSecurity" component={SettingsSecurityScreen} options={{ title: 'Security' }} />
      <Stack.Screen name="SettingsServer" component={SettingsServerScreen} options={{ title: 'Server' }} />
      <Stack.Screen name="KeyVerification" component={KeyVerificationScreen} options={{ title: 'Verify Identity' }} />
      <Stack.Screen name="Federation" component={FederationScreen} options={{ title: 'Federation' }} />

      {/* Wave H: Feature Enhancement */}
      <Stack.Screen name="MusicRoom" component={MusicRoomScreen} options={({ route }) => ({ title: `Music - ${route.params.channelName}` })} />
      <Stack.Screen name="StudyRoom" component={StudyRoomScreen} options={({ route }) => ({ title: `Study - ${route.params.channelName}` })} />
      <Stack.Screen name="StudyLeaderboard" component={StudyLeaderboardScreen} options={{ title: 'Study Leaderboard' }} />
      <Stack.Screen name="StageChannel" component={StageChannelScreen} options={({ route }) => ({ title: route.params.channelName })} />
      <Stack.Screen name="Auctions" component={AuctionsScreen} options={{ title: 'Auctions' }} />
      <Stack.Screen name="AuctionDetail" component={AuctionDetailScreen} options={{ title: 'Auction' }} />
      <Stack.Screen name="CreateAuction" component={CreateAuctionScreen} options={{ title: 'Create Auction' }} />
      <Stack.Screen name="GuildForms" component={GuildFormsScreen} options={{ title: 'Forms' }} />
      <Stack.Screen name="FormFill" component={FormFillScreen} options={{ title: 'Fill Form' }} />
      <Stack.Screen name="FormResponses" component={FormResponsesScreen} options={{ title: 'Responses' }} />
      <Stack.Screen name="FormCreate" component={FormCreateScreen} options={{ title: 'Create Form' }} />
      <Stack.Screen name="Connections" component={ConnectionsScreen} options={{ title: 'Connections' }} />
      <Stack.Screen name="InterestTags" component={InterestTagsScreen} options={{ title: 'Interests' }} />
      <Stack.Screen name="InterestMatches" component={InterestMatchesScreen} options={{ title: 'Interest Matches' }} />
      <Stack.Screen name="SeasonalEvents" component={SeasonalEventsScreen} options={{ title: 'Events' }} />
      <Stack.Screen name="Clips" component={ClipsScreen} options={{ title: 'Clips' }} />
      <Stack.Screen name="HelpCenter" component={HelpCenterScreen} options={{ title: 'Help Center' }} />
      <Stack.Screen name="HelpArticle" component={HelpArticleScreen} options={{ title: 'Help' }} />
      <Stack.Screen name="FameDashboard" component={FameDashboardScreen} options={{ title: 'Fame' }} />
      <Stack.Screen name="CommandPalette" component={CommandPaletteScreen} options={{ title: 'Quick Jump', presentation: 'modal' }} />

      {/* Deep-link: password reset (accessible even when logged in) */}
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
    </ErrorBoundary>
  );
}
