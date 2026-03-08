export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type AppTabParamList = {
  Guilds: undefined;
  DMs: undefined;
  Friends: undefined;
  Notifications: undefined;
};

export type AppStackParamList = {
  MainTabs: undefined;
  GuildDrawer: { guildId: string; guildName: string };
  GuildChannels: { guildId: string; guildName: string };
  ChannelChat: { channelId: string; channelName: string; guildId: string };
  VoiceChannel: { channelId: string; channelName: string; guildId: string };
  DirectMessage: { channelId: string; recipientName: string };
  CreateGuild: undefined;
  GuildSettings: { guildId: string; guildName: string };
  GuildMemberList: { guildId: string; guildName: string };
  InviteAccept: { code: string };
  // User system
  UserProfile: { userId: string };
  Settings: undefined;
  SettingsAccount: undefined;
  SettingsAppearance: undefined;
  SettingsNotifications: undefined;
  SettingsPrivacy: undefined;
  SettingsSessions: undefined;
  SettingsMutedUsers: undefined;
  NotificationInbox: undefined;
  // Social & DMs
  GroupDMCreate: undefined;
  GroupDMSettings: { channelId: string };
  DMSearch: undefined;
  FriendAdd: undefined;
  MessageRequests: undefined;
  // Server management
  RoleList: { guildId: string };
  RoleEdit: { guildId: string; roleId?: string };
  ChannelCreate: { guildId: string; parentId?: string };
  ChannelEdit: { channelId: string; guildId: string };
  InviteList: { guildId: string };
  MemberModerate: { guildId: string; userId: string; username: string };
  // Content types
  ThreadView: { threadId: string; threadName: string };
  ThreadList: { channelId: string; channelName: string };
  Bookmarks: undefined;
  GlobalSearch: undefined;
  // Discovery & organization
  ServerDiscover: undefined;
  ServerFolders: undefined;
  ScheduledEvents: { guildId: string };
  EventDetail: { guildId: string; eventId: string };
  EventCreate: { guildId: string; eventId?: string };
  GuildInsights: { guildId: string };
  // Economy & cosmetics
  Shop: undefined;
  Inventory: undefined;
  Wallet: undefined;
  // Advanced features
  ForumChannel: { channelId: string; channelName: string };
  WikiChannel: { channelId: string; channelName: string };
  AnnouncementChannel: { channelId: string; channelName: string; guildId: string };
  AuditLog: { guildId: string };
  WebhookManagement: { guildId: string };
  BanAppeals: { guildId: string };
  WordFilterScreen: { guildId: string };
  RaidProtection: { guildId: string };
};
