import React from 'react';
import { View, Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAppState } from '../contexts/AppStateContext';
import { useTheme } from '../lib/theme';
import { selectionFeedback } from '../lib/haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

const Tab = createBottomTabNavigator<AppTabParamList>();
const Stack = createNativeStackNavigator<AppStackParamList>();

function MainTabs() {
  const insets = useSafeAreaInsets();
  const { notificationCount } = useAppState();
  const { colors, fontSize, neo } = useTheme();

  return (
    <Tab.Navigator
      screenListeners={{
        tabPress: () => selectionFeedback(),
      }}
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bgSecondary,
          borderTopColor: colors.border,
          borderTopWidth: neo ? 3 : 1,
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 6,
        },
        tabBarActiveTintColor: colors.accentPrimary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIconStyle: {
          marginBottom: 2,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: neo ? '800' : '500',
          ...(neo ? { textTransform: 'uppercase' as const } : {}),
        },
      }}
    >
      <Tab.Screen
        name="Guilds"
        component={GuildListScreen}
        options={{
          tabBarLabel: 'Servers',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'planet' : 'planet-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="DMs"
        component={DMListScreen}
        options={{
          tabBarLabel: 'Chats',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'chatbubbles' : 'chatbubbles-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Friends"
        component={FriendsScreen}
        options={{
          tabBarLabel: 'Friends',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'people' : 'people-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationInboxScreen}
        options={{
          tabBarLabel: 'Alerts',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'notifications' : 'notifications-outline'} size={22} color={color} />
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
  );
}

export default function AppNavigator() {
  const { colors, neo } = useTheme();

  const defaultStackOpts = React.useMemo(() => ({
    headerStyle: {
      backgroundColor: colors.bgSecondary,
      ...(neo ? { borderBottomWidth: 3, borderBottomColor: colors.border } : {}),
    },
    headerTintColor: colors.textPrimary,
    headerTitleStyle: {
      fontWeight: neo ? '800' as const : '600' as const,
      ...(neo ? { textTransform: 'uppercase' as const } : {}),
    },
    contentStyle: { backgroundColor: colors.bgPrimary },
  }), [colors, neo]);

  return (
    <Stack.Navigator screenOptions={defaultStackOpts}>
      <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
      <Stack.Screen name="GuildDrawer" component={GuildDrawerNavigator} options={{ headerShown: false }} />
      <Stack.Screen name="DirectMessage" component={DirectMessageScreen} options={({ route }) => ({ title: route.params.recipientName })} />
      <Stack.Screen name="CreateGuild" component={CreateGuildScreen} options={{ title: 'Create Server' }} />
      <Stack.Screen name="GuildSettings" component={GuildSettingsScreen} options={({ route }) => ({ title: `${route.params.guildName} Settings` })} />
      <Stack.Screen name="GuildMemberList" component={GuildMemberListScreen} options={{ title: 'Members' }} />
      <Stack.Screen name="InviteAccept" component={InviteAcceptScreen} options={{ title: 'Server Invite' }} />

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
      <Stack.Screen name="ServerDiscover" component={ServerDiscoverScreen} options={{ title: 'Discover Servers' }} />
      <Stack.Screen name="ServerFolders" component={ServerFoldersScreen} options={{ title: 'Server Folders' }} />
      <Stack.Screen name="ScheduledEvents" component={ScheduledEventsScreen} options={{ title: 'Events' }} />
      <Stack.Screen name="EventDetail" component={EventDetailScreen} options={{ title: 'Event' }} />
      <Stack.Screen name="EventCreate" component={EventCreateScreen} options={({ route }) => ({ title: route.params.eventId ? 'Edit Event' : 'Create Event' })} />
      <Stack.Screen name="GuildInsights" component={GuildInsightsScreen} options={{ title: 'Server Insights' }} />

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
    </Stack.Navigator>
  );
}
