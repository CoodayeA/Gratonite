import { Router } from 'express';
import { authRouter } from './auth';
import { usersRouter } from './users';
import { guildsRouter } from './guilds';
import { channelsRouter } from './channels';
import { messagesRouter } from './messages';
import { relationshipsRouter } from './relationships';
import { filesRouter } from './files';
import { voiceRouter, voiceStatesRouter } from './voice';
import { settingsRouter } from './settings';
import { rolesRouter } from './roles';
import { invitesRouter } from './invites';
import { reactionsRouter } from './reactions';
import { pinsRouter } from './pins';
import { bansRouter } from './bans';
import { searchRouter } from './search';
import { threadsRouter } from './threads';
import { notificationsRouter } from './notifications';
import { emojisRouter } from './emojis';
import { channelOverridesRouter } from './channel-overrides';
import { bugReportsRouter } from './bug-reports';
import { reportsRouter } from './reports';
import { feedbackRouter } from './feedback';
import { leaderboardRouter } from './leaderboard';
import { wikiRouter } from './wiki';
import { eventsRouter } from './events';
import { channelPollsRouter, pollsRouter } from './polls';
import { shopRouter } from './shop';
import { economyRouter } from './economy';
import { cosmeticsRouter } from './cosmetics';
import { botStoreRouter } from './bot-store';
import { themesRouter } from './themes';
import { adminShopRouter } from './admin-shop';
import { inventoryRouter } from './inventory';
import { auctionsRouter } from './auctions';
import { botApplicationsRouter } from './bot-applications';
import { adminRouter } from './admin';
import { marketplaceRouter } from './marketplace';
import { telemetryRouter } from './telemetry';
import { fameRouter } from './fame';
import { groupDmsRouter } from './group-dms';
import { connectionsRouter } from './connections';
import { keysRouter } from './keys';
import { groupKeysRouter } from './group-keys';
import { stageRouter } from './stage';
import { workflowsRouter } from './workflows';
import { webhooksRouter } from './webhooks';
import { moderationRouter } from './moderation';
import { templatesRouter } from './templates';
import { automodRouter } from './automod';
import { commandsRouter } from './commands';
import { stickersRouter } from './stickers';
import { pushRouter } from './push';
import { referralsRouter } from './referrals';
import { draftsRouter } from './drafts';
import { bookmarksRouter } from './bookmarks';
import { channelDocumentsRouter } from './channel-documents';
import { mutesRouter } from './mutes';
import { oauthRouter } from './oauth';
import { wordFilterRouter } from './word-filter';
import { channelNotifPrefsRouter } from './channel-notification-prefs';
import { clipsRouter } from './clips';
import { achievementsRouter } from './achievements';
import { activityRouter } from './activity';
import { seasonalEventsRouter } from './seasonal-events-route';
import { statsRouter } from './stats';
import { authRateLimit, apiRateLimit } from '../middleware/rateLimit';
import { registry } from '../lib/metrics';

// Wave 25 imports
import { reactionRolesRouter } from './reaction-roles';
import { stickyMessagesRouter } from './sticky-messages';
import { remindersRouter } from './reminders';
import { starboardRouter } from './starboard';
import { autoRolesRouter } from './auto-roles';
import { showcaseRouter } from './showcase';
import { friendshipStreaksRouter } from './friendship-streaks';
import { interestTagsRouter } from './interest-tags';
import { greetingCardsRouter } from './greeting-cards';
import { textReactionsRouter, textReactionPopularRouter } from './text-reactions';
import { timelineRouter } from './timeline';
import { ticketsRouter } from './tickets';
import { giveawaysRouter } from './giveaways';
import { onboardingRouter } from './onboarding';
import { guildLogRouter } from './guild-log';
import { guildDigestRouter } from './guild-digest';
import { musicRoomsRouter } from './music-rooms';
import { whiteboardsRouter } from './whiteboards';
import { moodBoardsRouter } from './mood-boards';
import { photoAlbumsRouter } from './photo-albums';
import { voiceEffectsRouter } from './voice-effects';
import { studyRoomsRouter } from './study-rooms';
import { guildQuestsRouter } from './guild-quests';
import { guildFormsRouter } from './guild-forms';
import { confessionsRouter } from './confessions';
import { federationRouter } from './federation';
import { relayRouter } from './relay';
import { setupRouter } from './setup';
import { tasksRouter } from './tasks';
import { profilesSocialRouter } from './profiles-social';
import { clientErrorsRouter } from './client-errors';
import { friendSuggestionsRouter } from './friend-suggestions';
import { dailyChallengesRouter } from './daily-challenges';
import { watchPartiesRouter } from './watch-parties';
import { playlistsRouter } from './playlists';
import { guildCurrencyRouter } from './guild-currency';
import { giftsRouter } from './gifts';
import { welcomeScreenRouter } from './welcome-screen';
import { cardsRouter } from './cards';
import { botPermissionsRouter } from './bot-permissions';
import { storiesRouter } from './stories';

// Phase 4 & 5 imports (items 81-110)
import { spamDetectionRouter } from './spam-detection';
import { soundboardRouter } from './soundboard';
import { guildBackupRouter } from './guild-backup';
import { modQueueRouter } from './mod-queue';
import { guildHighlightsRouter } from './guild-highlights';
import { vanityProfileRouter } from './vanity-profile';
import { openapiRouter } from './openapi';

// Cutting-edge features (Wave 26)
import { spatialRoomsRouter } from './spatial-rooms';
import { channelPresenceRouter } from './channel-presence';
import { ephemeralPodsRouter } from './ephemeral-pods';
import { voiceReactionsRouter } from './voice-reactions';
import { focusSessionsRouter } from './focus-sessions';
import { channelBookmarksRouter } from './channel-bookmarks';
import { messageComponentsRouter } from './message-components';
import { guildDigestGenerateRouter } from './guild-digest-generate';
import { threadDashboardRouter } from './thread-dashboard';
import { notificationSoundsRouter } from './notification-sounds';
import { ambientRoomsRouter } from './ambient-rooms';
import { p2pTransferRouter } from './p2p-transfer';
import { serverStatusRouter } from './server-status';
import { scheduleCalendarRouter } from './schedule-calendar';
import { readingListsRouter } from './reading-lists';
import { channelFollowingRouter, guildFollowingRouter } from './channel-following';
import { dndScheduleRouter } from './dnd-schedule';
import { snippetsRouter } from './snippets';
import { documentsRouter } from './documents';
import { documentTemplatesRouter } from './document-templates';
import { rssFeedsRouter } from './rss-feeds';

export const router = Router();

// Health check
router.get('/', (_req, res) => {
  res.status(200).json({ message: 'gratonite-api v1' });
});

// Instance info — public endpoint for federated platforms, monitoring, and third-party clients
router.get('/instance', (_req, res) => {
  const domain = process.env.INSTANCE_DOMAIN || 'localhost';
  const version = process.env.npm_package_version || '1.0.0';
  const federationEnabled = process.env.FEDERATION_ENABLED === 'true';
  const registrationOpen = process.env.REGISTRATION_OPEN !== 'false'; // default open

  res.status(200).json({
    domain,
    version,
    software: { name: 'gratonite', version },
    federation: { enabled: federationEnabled },
    registrations: { open: registrationOpen },
    urls: {
      wellKnown: '/.well-known/gratonite',
    },
  });
});

// Prometheus metrics (internal only)
router.get('/metrics', async (req, res) => {
  const allowedIPs = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
  const clientIP = req.ip || req.socket.remoteAddress || '';
  if (!allowedIPs.includes(clientIP)) {
    res.status(403).json({ error: 'Forbidden' }); return;
  }
  res.set('Content-Type', registry.contentType);
  res.send(await registry.metrics());
});

router.get('/capabilities', (_req, res) => {
  res.status(200).json({
    routes: {
      adminTeam: true,
      adminAudit: true,
      adminBotModeration: true,
      messageRequests: true,
      botStore: true,
      marketplace: true,
      voice: true,
    },
    source: 'server',
  });
});

router.use('/docs', openapiRouter);

// Public stats (no auth, before rate limiter)
router.use('/stats', statsRouter);

// Client error reports (no auth — errors happen during login too)
router.use('/client-errors', clientErrorsRouter);

// Global API rate limit (60 req/min per authenticated user).
// Applied before feature routers so every authenticated endpoint is covered.
// Keyed by req.userId — requests without a userId pass through (auth
// middleware will reject them anyway).
router.use(apiRateLimit);

// Core feature routers
router.use('/auth', authRateLimit, authRouter);
router.use('/users', usersRouter);
router.use('/users/@me/settings', settingsRouter);
router.use('/guilds', guildsRouter);
router.use('/', channelsRouter);
router.use('/channels/:channelId/messages', messagesRouter);
router.use('/channels/:channelId/messages/:messageId/reactions', reactionsRouter);
router.use('/channels/:channelId/permissions', channelOverridesRouter);
router.use('/channels/:channelId/pins', pinsRouter);
router.use('/channels/:channelId/threads', threadsRouter);
router.use('/guilds/:guildId/roles', rolesRouter);
router.use('/guilds/:guildId/bans', bansRouter);
router.use('/guilds/:guildId/emojis', emojisRouter);
router.use('/stickers', stickersRouter);
router.use('/guilds/:guildId/stickers', stickersRouter);
router.use('/push', pushRouter);
router.use('/referrals', referralsRouter);
router.use('/', invitesRouter); // invites has mixed mount paths
router.use('/relationships', relationshipsRouter);
router.use('/friend-suggestions', friendSuggestionsRouter);
router.use('/dms/group', groupDmsRouter);
router.use('/users', connectionsRouter);
router.use('/files', filesRouter);
router.use('/voice', voiceRouter);
router.use('/channels/:channelId', voiceStatesRouter);
router.use('/search', searchRouter);
router.use('/notifications', notificationsRouter);
router.use('/telemetry', telemetryRouter);

// Thread messages (separate mount for thread-specific message fetching)
router.use('/threads', threadsRouter);

// Leaderboard (global + per-guild)
router.use('/', leaderboardRouter);

// Wiki pages (CRUD + revisions)
router.use('/', wikiRouter);

// Scheduled events
router.use('/guilds/:guildId/scheduled-events', eventsRouter);

// Polls
router.use('/channels/:channelId/polls', channelPollsRouter);
router.use('/polls', pollsRouter);

// Bug reports, content reports & feedback
router.use('/bug-reports', bugReportsRouter);
router.use('/', reportsRouter); // mounts /reports and /admin/reports
router.use('/', feedbackRouter); // mounts /feedback, /feedback/mine, /admin/feedback

// Economy, shop & cosmetics
router.use('/shop', shopRouter);
router.use('/economy', economyRouter);
router.use('/cosmetics', cosmeticsRouter);
router.use('/inventory', inventoryRouter);

// Daily challenges
router.use('/daily-challenges', dailyChallengesRouter);

// Auctions
router.use('/auctions', auctionsRouter);

// Marketplace listings
router.use('/marketplace', marketplaceRouter);

// Admin shop management
router.use('/admin/shop', adminShopRouter);

// Bot Store & Bot Installs
router.use('/', botStoreRouter);

// Bot Applications (webhook bots)
router.use('/bots/applications', botApplicationsRouter);

// Theme Store
router.use('/', themesRouter);

// Fame
router.use('/users/:userId/fame', fameRouter);

// E2E encryption key management
router.use('/users', keysRouter);

// Group E2E encryption key management
router.use('/channels', groupKeysRouter);

// Workflow automation
router.use('/guilds', workflowsRouter);

// Webhooks (create, list, delete, execute)
router.use('/', webhooksRouter);

// Platform Admin
router.use('/admin', adminRouter);

// Stage channels
router.use('/', stageRouter);

// Moderation (warnings)
router.use('/guilds/:guildId/members', moderationRouter);
// Moderation (delete warning by id — mounted separately for /guilds/:guildId/warnings/:warningId)
router.use('/guilds/:guildId', moderationRouter);

// Server templates
router.use('/guilds/:guildId/templates', templatesRouter);
router.use('/guilds', templatesRouter); // for /guilds/templates/:code

// AutoMod
router.use('/guilds/:guildId/auto-moderation', automodRouter);

// Slash commands + component interactions
router.use('/guilds/:guildId/commands', commandsRouter);
router.use('/', commandsRouter); // for /applications/:appId/..., /channels/:channelId/interactions, /channels/:channelId/messages/:messageId/components/...

// Message drafts (per-channel)
router.use('/', draftsRouter);

// Message bookmarks (user-scoped)
router.use('/', bookmarksRouter);

// Channel documents (shared notes)
router.use('/', channelDocumentsRouter);

// User mutes
router.use('/users', mutesRouter);

// OAuth2
router.use('/oauth', oauthRouter);

// Guild word filter
router.use('/guilds/:guildId/word-filter', wordFilterRouter);

// Per-channel notification preferences
router.use('/channels/:channelId', channelNotifPrefsRouter);

// Clips
router.use('/guilds/:guildId/clips', clipsRouter);
router.use('/clips', clipsRouter);

// Achievements
router.use('/', achievementsRouter);

// Activity feed
router.use('/', activityRouter);

// Seasonal events
router.use('/', seasonalEventsRouter);

// Wave 25 features
router.use('/guilds/:guildId/reaction-roles', reactionRolesRouter);
router.use('/channels/:channelId/sticky', stickyMessagesRouter);
router.use('/reminders', remindersRouter);
router.use('/guilds/:guildId/starboard', starboardRouter);
router.use('/guilds/:guildId/auto-roles', autoRolesRouter);
router.use('/', showcaseRouter);
router.use('/relationships', friendshipStreaksRouter);
router.use('/', interestTagsRouter);
router.use('/greeting-cards', greetingCardsRouter);
router.use('/channels/:channelId/messages/:messageId/text-reactions', textReactionsRouter);
router.use('/guilds/:guildId/text-reactions', textReactionPopularRouter);
router.use('/guilds/:guildId/timeline', timelineRouter);
router.use('/guilds/:guildId/tickets', ticketsRouter);
router.use('/guilds/:guildId/giveaways', giveawaysRouter);
router.use('/guilds/:guildId/onboarding', onboardingRouter);
router.use('/guilds/:guildId/log-config', guildLogRouter);
router.use('/guilds/:guildId/digest', guildDigestRouter);
router.use('/channels/:channelId/music', musicRoomsRouter);
router.use('/channels/:channelId/whiteboards', whiteboardsRouter);
router.use('/channels/:channelId/mood-board', moodBoardsRouter);
router.use('/guilds/:guildId/albums', photoAlbumsRouter);
router.use('/', voiceEffectsRouter);
router.use('/', studyRoomsRouter);
router.use('/guilds/:guildId/quests', guildQuestsRouter);
router.use('/guilds/:guildId/forms', guildFormsRouter);
router.use('/', confessionsRouter);

// Federation
router.use('/federation', federationRouter);

// Relay directory
router.use('/relays', relayRouter);

// Self-host setup wizard
router.use('/setup', setupRouter);

// Task boards (Kanban per channel)
router.use('/tasks', tasksRouter);

// Stream 3: Profiles, Social & Economy
router.use('/', profilesSocialRouter);

// Watch parties (synchronized video)
router.use('/channels/:channelId/watch-party', watchPartiesRouter);

// Collaborative playlists
router.use('/channels/:channelId/playlists', playlistsRouter);

// Server-specific currency
router.use('/guilds/:guildId/currency', guildCurrencyRouter);

// Gift subscriptions
router.use('/gifts', giftsRouter);

// Guild welcome screens
router.use('/guilds/:guildId/welcome-screen', welcomeScreenRouter);

// Collectible cards (gacha system)
router.use('/cards', cardsRouter);

// Bot permissions (per-guild)
router.use('/guilds/:guildId/bots', botPermissionsRouter);

// Stories / moments (ephemeral 24h posts)
router.use('/stories', storiesRouter);

// Phase 4 & 5 routes (items 81-110)
router.use('/guilds/:guildId/spam-config', spamDetectionRouter);
router.use('/guilds/:guildId/soundboard', soundboardRouter);
router.use('/guilds/:guildId/backups', guildBackupRouter);
router.use('/guilds/:guildId/mod-queue', modQueueRouter);
router.use('/guilds/:guildId/highlights', guildHighlightsRouter);
router.use('/users', vanityProfileRouter);

// Phase 6: Productivity & Collaboration (items 106-120)
import { calendarsRouter } from './calendars';
import { fileManagerRouter } from './file-manager';
import { meetingSchedulerRouter } from './meeting-scheduler';
import { todoListsRouter } from './todo-lists';
import { integrationsRouter } from './integrations';
import { botFrameworkRouter } from './bot-framework';
import { standupRouter } from './standup';
import { timezoneRouter } from './timezone';
import { afkRouter } from './afk';

router.use('/guilds/:guildId/calendar', calendarsRouter);
router.use('/guilds/:guildId/file-manager', fileManagerRouter);
router.use('/guilds/:guildId/meetings', meetingSchedulerRouter);
router.use('/channels/:channelId/todos', todoListsRouter);
router.use('/guilds/:guildId/integrations', integrationsRouter);
router.use('/bots/framework', botFrameworkRouter);
router.use('/guilds/:guildId/standup', standupRouter);
router.use('/users', timezoneRouter);
router.use('/users', afkRouter);

// Phase 7: Gamification & Engagement (items 121-135)
import { xpRouter } from './xp';
import { loginRewardsRouter } from './login-rewards';
import { userTitlesRouter } from './user-titles';
import { quizzesRouter } from './quizzes';
import { reputationRouter } from './reputation';

router.use('/', xpRouter);
router.use('/', loginRewardsRouter);
router.use('/', userTitlesRouter);
router.use('/guilds/:guildId/quizzes', quizzesRouter);
router.use('/', reputationRouter);

// Wave 26: Cutting-edge features
router.use('/channels/:channelId/spatial-room', spatialRoomsRouter);
router.use('/channels/:channelId/presence', channelPresenceRouter);
router.use('/guilds/:guildId/pods', ephemeralPodsRouter);
router.use('/voice-reactions', voiceReactionsRouter);
router.use('/channels/:channelId/focus-sessions', focusSessionsRouter);
router.use('/channels/:channelId/bookmarks', channelBookmarksRouter);
router.use('/channels/:channelId/messages/:messageId/components', messageComponentsRouter);
router.use('/guilds/:guildId/digest', guildDigestGenerateRouter);
router.use('/guilds/:guildId/threads', threadDashboardRouter);
router.use('/notification-sounds', notificationSoundsRouter);
router.use('/channels/:channelId/ambient-room', ambientRoomsRouter);
router.use('/p2p', p2pTransferRouter);
router.use('/guilds/:guildId/status', serverStatusRouter);
router.use('/users/@me/scheduled-messages', scheduleCalendarRouter);
router.use('/channels/:channelId/reading-list', readingListsRouter);
router.use('/channels/:channelId/followers', channelFollowingRouter);
router.use('/guilds/:guildId/following', guildFollowingRouter);
router.use('/', dndScheduleRouter);
router.use('/', snippetsRouter);

// RSS feed subscriptions
router.use('/guilds/:guildId/rss-feeds', rssFeedsRouter);

// Collaborative documents (CRDT)
router.use('/', documentsRouter);

// Document templates (per-guild + apply to channel)
router.use('/', documentTemplatesRouter);

// Google Calendar sync (user-scoped integrations)
import { calendarSyncRouter } from './calendar-sync';
router.use('/', calendarSyncRouter);

// Inline message translation (LibreTranslate)
import { translateRouter } from './translate';
router.use('/messages', translateRouter);

// Per-server member profiles
import { guildMemberProfilesRouter } from './guild-member-profiles';
router.use('/guilds/:guildId/members', guildMemberProfilesRouter);
