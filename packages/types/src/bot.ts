import type { Snowflake } from './snowflake';

// ==========================================================================
// Bot platform types
// ==========================================================================

export interface OAuthApp {
  id: Snowflake;
  ownerId: Snowflake;
  name: string;
  description: string | null;
  iconHash: string | null;
  redirectUris: string[];
  botPublic: boolean;
  botRequireCodeGrant: boolean;
  termsUrl: string | null;
  privacyUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BotUser {
  applicationId: Snowflake;
  userId: Snowflake;
  public: boolean;
  createdAt: string;
}

export interface SlashCommand {
  id: Snowflake;
  applicationId: Snowflake;
  guildId: Snowflake | null;
  name: string;
  description: string;
  options: unknown[];
  defaultMemberPermissions: string;
  dmPermission: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface OAuthTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string;
  tokenType: string;
}
