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
import { authRateLimit, apiRateLimit } from '../middleware/rateLimit';

export const router = Router();

// Health check
router.get('/', (_req, res) => {
  res.status(200).json({ message: 'gratonite-api v1' });
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
router.use('/', invitesRouter); // invites has mixed mount paths
router.use('/relationships', relationshipsRouter);
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

// Platform Admin
router.use('/admin', adminRouter);
