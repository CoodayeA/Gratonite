export type GuildSettingsTabId =
  | 'overview' | 'channels' | 'roles' | 'members' | 'bans' | 'invites'
  | 'emojis' | 'automod' | 'audit' | 'branding' | 'webhooks' | 'bots'
  | 'templates' | 'insights' | 'onboarding' | 'wordfilter' | 'security'
  | 'import' | 'boosts' | 'welcome' | 'currency' | 'stickers' | 'rules'
  | 'discovery' | 'soundboard' | 'spam' | 'backups' | 'modqueue'
  | 'highlights' | 'federation';

export interface GuildSettingsTabEntry {
  tab: GuildSettingsTabId;
  label: string;
  keywords: readonly string[];
}

export interface GuildSettingsTabGroup {
  id: string;
  label: string;
  tabs: readonly GuildSettingsTabId[];
}

export const GUILD_SETTINGS_TABS: readonly GuildSettingsTabEntry[] = [
  { tab: 'overview', label: 'Overview', keywords: ['overview', 'server name', 'description', 'icon', 'banner', 'accent', 'afk', 'verification', 'system messages', 'delete server', 'vanity url'] },
  { tab: 'channels', label: 'Channels', keywords: ['channels', 'create channel', 'delete channel', 'categories', 'text channel', 'voice channel', 'forum', 'announcement', 'wiki', 'qa', 'confession', 'task'] },
  { tab: 'roles', label: 'Roles', keywords: ['roles', 'permissions', 'create role', 'delete role', 'administrator', 'manage roles', 'color', 'role color'] },
  { tab: 'members', label: 'Members', keywords: ['members', 'kick', 'ban', 'timeout', 'assign role', 'member search', 'bulk kick', 'bulk ban'] },
  { tab: 'bans', label: 'Bans', keywords: ['bans', 'banned users', 'unban', 'ban appeals', 'ban list'] },
  { tab: 'invites', label: 'Invites', keywords: ['invites', 'invite links', 'revoke invite', 'invite management', 'invite codes'] },
  { tab: 'automod', label: 'AutoMod', keywords: ['automod', 'auto moderation', 'automated rules', 'keyword filter', 'delete message', 'workflows'] },
  { tab: 'wordfilter', label: 'Word Filter', keywords: ['word filter', 'blocked words', 'profanity', 'regex', 'exempt roles', 'word block', 'filter test'] },
  { tab: 'spam', label: 'Spam Detection', keywords: ['spam', 'spam detection', 'duplicate messages', 'mention spam', 'link spam', 'auto mute', 'rate limit'] },
  { tab: 'modqueue', label: 'Mod Queue', keywords: ['mod queue', 'moderation queue', 'reported content', 'flagged messages', 'approve', 'reject'] },
  { tab: 'audit', label: 'Audit Log', keywords: ['audit log', 'audit', 'history', 'action history', 'moderation log'] },
  { tab: 'security', label: 'Security', keywords: ['security', 'raid protection', 'lock server', 'verification level', 'member screening', 'public stats', 'notifications'] },
  { tab: 'welcome', label: 'Welcome Screen', keywords: ['welcome', 'welcome screen', 'welcome message', 'onboarding blocks', 'welcome channels'] },
  { tab: 'onboarding', label: 'Onboarding', keywords: ['onboarding', 'onboarding flow', 'new member', 'prompts', 'default channels'] },
  { tab: 'rules', label: 'Server Rules', keywords: ['rules', 'server rules', 'rules text', 'require agreement'] },
  { tab: 'discovery', label: 'Discovery Tags', keywords: ['discovery', 'tags', 'category', 'discoverability', 'server listing', 'search tags'] },
  { tab: 'soundboard', label: 'Soundboard', keywords: ['soundboard', 'sound clips', 'voice sounds', 'audio clips', 'sound board'] },
  { tab: 'highlights', label: 'Highlights', keywords: ['highlights', 'server highlights', 'pinned moments', 'showcase'] },
  { tab: 'insights', label: 'Insights', keywords: ['insights', 'analytics', 'statistics', 'growth', 'member growth', 'messages', 'activity', 'top channels'] },
  { tab: 'emojis', label: 'Emojis', keywords: ['emojis', 'custom emojis', 'emoji upload', 'emoji categories', 'reaction'] },
  { tab: 'stickers', label: 'Stickers', keywords: ['stickers', 'custom stickers', 'sticker pack'] },
  { tab: 'branding', label: 'Brand Identity', keywords: ['branding', 'brand', 'accent color', 'server color', 'identity'] },
  { tab: 'webhooks', label: 'Webhooks', keywords: ['webhooks', 'webhook', 'integrations', 'incoming webhook', 'webhook url'] },
  { tab: 'bots', label: 'Installed Bots', keywords: ['bots', 'installed bots', 'bot management', 'slash commands', 'bot prefix'] },
  { tab: 'boosts', label: 'Server Boosts', keywords: ['boosts', 'boost', 'server boosts', 'nitro', 'boost tier', 'perks'] },
  { tab: 'currency', label: 'Server Currency', keywords: ['currency', 'server currency', 'coins', 'economy', 'balance'] },
  { tab: 'backups', label: 'Backups', keywords: ['backups', 'server backup', 'export', 'restore', 'backup download', 'backup verify'] },
  { tab: 'templates', label: 'Templates', keywords: ['templates', 'server template', 'template code', 'clone server'] },
  { tab: 'import', label: 'Import', keywords: ['import', 'server import', 'discord import', 'slack import', 'migrate'] },
  { tab: 'federation', label: 'Federation', keywords: ['federation', 'relay', 'federated', 'activitypub', 'instances', 'portability'] },
];

export const GUILD_SETTINGS_TAB_GROUPS: readonly GuildSettingsTabGroup[] = [
  { id: 'setup', label: 'Server Setup', tabs: ['overview', 'channels', 'roles'] },
  { id: 'members', label: 'Members', tabs: ['members', 'bans', 'invites'] },
  { id: 'moderation', label: 'Moderation', tabs: ['automod', 'wordfilter', 'spam', 'modqueue', 'audit', 'security'] },
  { id: 'community', label: 'Community', tabs: ['welcome', 'onboarding', 'rules', 'discovery', 'soundboard', 'highlights'] },
  { id: 'analytics', label: 'Analytics', tabs: ['insights'] },
  { id: 'customization', label: 'Customization', tabs: ['emojis', 'stickers', 'branding'] },
  { id: 'integrations', label: 'Integrations', tabs: ['webhooks', 'bots'] },
  { id: 'premium', label: 'Premium', tabs: ['boosts', 'currency'] },
  { id: 'advanced', label: 'Advanced', tabs: ['backups', 'templates', 'import', 'federation'] },
];

export const GUILD_SETTINGS_MOBILE_TABS: readonly GuildSettingsTabId[] = [
  'overview', 'channels', 'roles', 'members', 'invites', 'templates', 'import',
  'emojis', 'stickers', 'branding', 'webhooks', 'bots', 'automod', 'wordfilter',
  'spam', 'bans', 'audit', 'modqueue', 'security', 'insights', 'onboarding',
  'rules', 'discovery', 'welcome', 'boosts', 'currency', 'soundboard', 'backups',
  'highlights', 'federation',
];
