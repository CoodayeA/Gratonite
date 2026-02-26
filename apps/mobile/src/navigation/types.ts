/**
 * Navigation type definitions for the mobile app.
 */

 * Navigation type definitions for all stacks and tabs.
 */

// ── Root ─────────────────────────────────────────────
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

// ── Auth ─────────────────────────────────────────────
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  VerifyEmailPending: { email: string };
  CompleteSetup: undefined;
};

// ── Main Tabs ────────────────────────────────────────
export type MainTabsParamList = {
  HomeTab: undefined;
  PortalsTab: undefined;
  DiscoverTab: undefined;
  InboxTab: undefined;
  ProfileTab: undefined;
};

export type HomeStackParamList = {
  Home: undefined;
};

export type PortalsStackParamList = {
  PortalsList: undefined;
  GuildRoles: { guildId: string; guildName?: string };
  GuildMembers: { guildId: string; guildName?: string };
};

export type DiscoverStackParamList = {
  Discover: undefined;
};

export type InboxStackParamList = {
  Inbox: undefined;
};

export type ProfileStackParamList = {
  Profile: undefined;
// ── Home Stack ───────────────────────────────────────
  Channel: { channelId: string; guildId?: string; name?: string };
  Thread: { threadId: string; channelId: string; parentMessageId?: string };
};

// ── Portals Stack ────────────────────────────────────
  GuildDetail: { guildId: string };
  Channel: { channelId: string; guildId?: string; name?: string };
  Thread: { threadId: string; channelId: string; parentMessageId?: string };
  CreateEvent: { guildId: string };
  Events: { guildId: string };
  GuildSettings: { guildId: string };
  MemberList: { guildId: string };
  RoleManagement: { guildId: string };
  InviteCreate: { guildId: string };
};

// ── Discover Stack ───────────────────────────────────
  GuildPreview: { guildId: string };
};

// ── Inbox Stack ──────────────────────────────────────
  DmChannel: { channelId: string; userId: string; name?: string };
};

// ── Profile Stack ────────────────────────────────────
  Settings: undefined;
  EditProfile: undefined;
};
