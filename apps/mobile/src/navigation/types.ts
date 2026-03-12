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
  DirectMessage: { channelId: string; recipientName: string; recipientId?: string; isGroupDm?: boolean };
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
  // Wave B: Chat enhancements
  Reminders: undefined;
  // Wave C: Social & guild features
  Leaderboard: { guildId: string };
  GiveawayList: { guildId: string };
  QuestBoard: { guildId: string };
  ConfessionBoard: { guildId: string };
  GreetingCards: undefined;
  PhotoAlbums: { guildId: string };
  TicketList: { guildId: string };
  Starboard: { guildId: string };
  // Wave D: Guild admin
  OnboardingConfig: { guildId: string };
  StarboardConfig: { guildId: string };
  AutoRoleConfig: { guildId: string };
  DigestConfig: { guildId: string };
  ActivityLog: { guildId: string };
  // Wave E: New channel types + marketplace
  TimelineChannel: { channelId: string; channelName: string };
  QAChannel: { channelId: string; channelName: string };
  Marketplace: undefined;
  // Wave F: Tier 2 admin
  ReactionRoleConfig: { guildId: string };
  WorkflowList: { guildId: string };
  // Wave G: App Store Readiness
  GuildBans: { guildId: string };
  EmojiManagement: { guildId: string };
  AutomodConfig: { guildId: string };
  ServerTemplates: { guildId: string };
  MFASetup: undefined;
  SettingsAppLock: undefined;
  SettingsSound: undefined;
  Feedback: undefined;
  Achievements: undefined;
  Cosmetics: undefined;
  ActivityFeed: undefined;
  UserStats: undefined;
  BotStore: undefined;
  SettingsSecurity: undefined;
  KeyVerification: { userId: string };
  // Wave H: Feature Enhancement
  MusicRoom: { channelId: string; channelName: string };
  StudyRoom: { channelId: string; channelName: string; guildId: string };
  StudyLeaderboard: { guildId: string };
  StageChannel: { channelId: string; channelName: string; guildId: string };
  Auctions: undefined;
  AuctionDetail: { auctionId: string };
  CreateAuction: undefined;
  GuildForms: { guildId: string };
  FormFill: { guildId: string; formId: string };
  FormResponses: { guildId: string; formId: string };
  FormCreate: { guildId: string; formId?: string };
  Connections: undefined;
  InterestTags: undefined;
  InterestMatches: { guildId: string };
  SeasonalEvents: undefined;
  Clips: { guildId: string };
  HelpCenter: undefined;
  HelpArticle: { articleId: string };
  FameDashboard: undefined;
  CommandPalette: undefined;
};
