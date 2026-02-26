/**
 * Navigation type definitions for the mobile app.
 */

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  VerifyEmailPending: { email: string };
  CompleteSetup: undefined;
};

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
};
