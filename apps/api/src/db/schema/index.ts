/**
 * schema/index.ts — Barrel export for all Drizzle ORM table schemas.
 */

export * from './users';
export * from './auth';
export * from './guilds';
export * from './guild-tags';
export * from './member-groups';
export * from './channels';
export * from './messages';
export * from './relationships';
export * from './files';
export * from './settings';
export * from './roles';
export * from './bans';
export * from './invites';
export * from './reactions';
export * from './pins';
export * from './threads';
export * from './emojis';
export * from './emoji-categories';
export * from './audit';
export * from './notifications';
export * from './channel-overrides';
export * from './reports';
export * from './events';
export * from './polls';
export * from './wiki';
export * from './shop';
export * from './economy';
export * from './cosmetics';
export * from './bot-store';
export * from './themes';
export * from './auctions';
export * from './bot-applications';
export * from './admin';
export * from './fameTransactions';
export * from './fameDailyLimits';
export * from './connected-accounts';
export * from './guild-onboarding';
export * from './encryption';
export * from './group-encryption';
export * from './stage';
export * from './workflows';
export * from './user-notes';
export * from './channel-read-state';
export * from './webhooks';
export * from './warnings';
export * from './templates';
export * from './channel-followers';
export * from './guild-folders';
export * from './favorite-channels';
export * from './automod-rules';
export * from './application-commands';
export * from './server-boosts';
export * from './call-history';
export * from './message-drafts';
export * from './scheduled-messages';
export * from './message-bookmarks';
export * from './bookmark-folders';
export * from './channel-documents';
export * from './data-exports';
export * from './user-mutes';
export * from './oauth';
export * from './webhook-delivery-logs';
export * from './guild-word-filters';
export * from './channel-notification-prefs';
export * from './stripe';
export * from './achievements';
export * from './activity-feed';
export * from './seasonal-events';
export * from './status-presets';
export * from './channel-featured-messages';
export * from './voice-messages';
export * from './quick-reactions';

// Wave 25 features
export * from './reaction-roles';
export * from './sticky-messages';
export * from './message-reminders';
export * from './starboard';
export * from './auto-roles';
export * from './profile-showcase';
export * from './friendship-streaks';
export * from './interest-tags';
export * from './greeting-cards';
export * from './text-reactions';
export * from './guild-timeline';
export * from './tickets';
export * from './giveaways';
export * from './onboarding-completions';
export * from './guild-log-config';
export * from './guild-digest';
export * from './music-rooms';
export * from './whiteboards';
export * from './mood-boards';
export * from './photo-albums';
export * from './voice-effects';
export * from './study-rooms';
export * from './guild-quests';
export * from './guild-forms';
export * from './confessions';
export * from './guild-ratings';

// Federation schemas
export * from './federation-instances';
export * from './federation-key-pairs';
export * from './remote-users';
export * from './remote-guilds';
export * from './guild-replicas';
export * from './federation-activities';
export * from './instance-blocks';
export * from './verification-requests';
export * from './instance-reports';
export * from './account-imports';

// Relay network
export * from './relay-nodes';
export * from './relay-connections';
export * from './relay-instance-keys';

// Daily challenges
export * from './daily-challenges';

// Login alerts
export * from './user-devices';

// Watch parties & collaborative playlists
export * from './watch-parties';
export * from './playlists';

// Server-specific currencies
export * from './guild-currencies';

// Gift subscriptions
export * from './gift-transactions';

// Collectible cards
export * from './collectible-cards';

// Guild welcome screens
export * from './guild-welcome-screens';

// Phase 6+7: Productivity & Gamification
export * from './calendars';
export * from './todo-lists';
export * from './meeting-scheduler';
export * from './integrations';
export * from './standup';
export * from './xp-system';
export * from './user-titles';
export * from './quizzes';
export * from './reputation';

// DND schedules & message snippets
export * from './dnd-schedules';
export * from './message-snippets';

// RSS feed subscriptions
export * from './rss-feeds';

// Collaborative documents (CRDT)
export * from './collaborative-documents';
export * from './document-templates';

// Per-server member profiles
export * from './guild-member-profiles';

// Previously missing schemas
export * from './ambient-rooms';
export * from './bot-guild-permissions';
export * from './calendar-integrations';
export * from './channel-bookmarks';
export * from './clips';
export * from './component-interactions';
export * from './dm-read-state';
export * from './focus-sessions';
export * from './guild-backups';
export * from './guild-highlights';
export * from './guild-soundboard';
export * from './guild-spam-config';
export * from './message-translations';
export * from './messageEditHistory';
export * from './mod-queue';
export * from './notification-sounds';
export * from './push-subscriptions';
export * from './reading-lists';
export * from './referrals';
export * from './server-status';
export * from './spatial-rooms';
export * from './stickers';
