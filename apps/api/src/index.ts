import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { env } from './env.js';
import { logger } from './lib/logger.js';
import { redis } from './lib/redis.js';
import { createDb } from '@gratonite/db';
import { securityHeaders } from './middleware/security-headers.js';
import { globalRateLimiter } from './middleware/rate-limiter.js';
import { authRouter } from './modules/auth/auth.router.js';
import { usersRouter } from './modules/users/users.router.js';
import { guildsRouter } from './modules/guilds/guilds.router.js';
import { channelsRouter } from './modules/channels/channels.router.js';
import { messagesRouter } from './modules/messages/messages.router.js';
import { invitesRouter } from './modules/invites/invites.router.js';
import { relationshipsRouter } from './modules/relationships/relationships.router.js';
import { voiceRouter } from './modules/voice/voice.router.js';
import { filesRouter } from './modules/files/files.router.js';
import { threadsRouter } from './modules/threads/threads.router.js';
import { searchRouter } from './modules/search/search.router.js';
import { wikiRouter } from './modules/wiki/wiki.router.js';
import { qaRouter } from './modules/qa/qa.router.js';
import { eventsRouter } from './modules/events/events.router.js';
import { autoModRouter } from './modules/automod/automod.router.js';
import { moderationRouter } from './modules/moderation/moderation.router.js';
import { analyticsRouter } from './modules/analytics/analytics.router.js';
import { themesRouter } from './modules/themes/themes.router.js';
import { brandRouter } from './modules/brand/brand.router.js';
import { profilesRouter } from './modules/profiles/profiles.router.js';
import { createThemesService } from './modules/themes/themes.service.js';
import { createThreadsService } from './modules/threads/threads.service.js';
import { createMessagesService } from './modules/messages/messages.service.js';
import { createEventsService } from './modules/events/events.service.js';
import { createAnalyticsService } from './modules/analytics/analytics.service.js';
import { setupGateway } from './modules/gateway/gateway.js';
import { RoomServiceClient } from 'livekit-server-sdk';
import { minioClient, ensureBuckets } from './lib/minio.js';

// ============================================================================
// Server bootstrap
// ============================================================================

async function main() {
  logger.info({ env: env.NODE_ENV }, 'Starting Gratonite API server');

  // ── Database connection ────────────────────────────────────────────────
  const { db } = createDb(env.DATABASE_URL);
  logger.info('Database connected');

  // ── Redis connection ───────────────────────────────────────────────────
  await redis.connect();

  // ── MinIO object storage ─────────────────────────────────────────────
  await ensureBuckets();
  logger.info('MinIO connected');

  // ── Express app ────────────────────────────────────────────────────────
  const app = express();
  const httpServer = createServer(app);

  // Middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    }),
  );
  app.use(securityHeaders);
  app.use(globalRateLimiter);

  // Trust proxy (for rate limiting behind Nginx/LB)
  app.set('trust proxy', 1);

  // ── Socket.IO ──────────────────────────────────────────────────────────
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingInterval: 25000,
    pingTimeout: 10000,
  });

  // ── LiveKit client ────────────────────────────────────────────────────
  const livekitClient = new RoomServiceClient(
    env.LIVEKIT_HTTP_URL,
    env.LIVEKIT_API_KEY,
    env.LIVEKIT_API_SECRET,
  );

  // ── Shared context for route handlers ──────────────────────────────────
  const ctx = { db, redis, io, env, livekit: livekitClient, minio: minioClient };

  // ── Health check ───────────────────────────────────────────────────────
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'gratonite-api',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // ── API routes ─────────────────────────────────────────────────────────
  app.use('/api/v1/auth', authRouter(ctx));
  app.use('/api/v1/users', usersRouter(ctx));
  app.use('/api/v1/guilds', guildsRouter(ctx));
  app.use('/api/v1', channelsRouter(ctx));   // handles /guilds/:id/channels and /channels/:id
  app.use('/api/v1', messagesRouter(ctx));   // handles /channels/:id/messages
  app.use('/api/v1/invites', invitesRouter(ctx));
  app.use('/api/v1/relationships', relationshipsRouter(ctx));
  app.use('/api/v1', voiceRouter(ctx));
  app.use('/api/v1', filesRouter(ctx));
  app.use('/api/v1', threadsRouter(ctx));
  app.use('/api/v1', searchRouter(ctx));
  app.use('/api/v1', wikiRouter(ctx));
  app.use('/api/v1', qaRouter(ctx));
  app.use('/api/v1', eventsRouter(ctx));
  app.use('/api/v1', autoModRouter(ctx));
  app.use('/api/v1', moderationRouter(ctx));
  app.use('/api/v1', analyticsRouter(ctx));
  app.use('/api/v1', themesRouter(ctx));
  app.use('/api/v1', brandRouter(ctx));
  app.use('/api/v1', profilesRouter(ctx));

  // ── 404 handler ────────────────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({
      code: 'NOT_FOUND',
      message: 'The requested resource was not found',
    });
  });

  // ── Error handler ──────────────────────────────────────────────────────
  app.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      logger.error({ err }, 'Unhandled error');
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message:
          env.NODE_ENV === 'production'
            ? 'An unexpected error occurred'
            : err.message,
      });
    },
  );

  // ── Seed built-in themes ─────────────────────────────────────────────
  const themesService = createThemesService(ctx);
  await themesService.seedBuiltInThemes();
  logger.info('Built-in themes seeded');

  // ── Thread auto-archive ──────────────────────────────────────────────
  const threadsService = createThreadsService(ctx);
  setInterval(() => {
    threadsService.archiveStaleThreads().catch((err) => {
      logger.warn({ err }, 'Failed to auto-archive threads');
    });
  }, 5 * 60 * 1000);

  // ── Scheduled messages processor ─────────────────────────────────────
  const messagesService = createMessagesService(ctx);
  setInterval(() => {
    messagesService.processScheduledMessages().catch((err) => {
      logger.warn({ err }, 'Failed to process scheduled messages');
    });
  }, 30 * 1000);

  // ── Event auto-start (every 60s) ────────────────────────────────────
  const eventsService = createEventsService(ctx);
  setInterval(() => {
    eventsService.autoStartEvents().catch((err) => {
      logger.warn({ err }, 'Failed to auto-start scheduled events');
    });
  }, 60 * 1000);

  // ── Analytics flush (every 5 min) ──────────────────────────────────
  const analyticsService = createAnalyticsService(ctx);
  setInterval(() => {
    analyticsService.flushAnalytics().catch((err) => {
      logger.warn({ err }, 'Failed to flush analytics');
    });
  }, 5 * 60 * 1000);

  // ── Hourly analytics cleanup (daily) ──────────────────────────────
  setInterval(() => {
    analyticsService.cleanupOldHourlyData().catch((err) => {
      logger.warn({ err }, 'Failed to cleanup old hourly analytics');
    });
  }, 24 * 60 * 60 * 1000);

  // ── Socket.IO gateway (auth, presence, real-time events) ─────────────
  setupGateway(ctx);

  // ── Start server ───────────────────────────────────────────────────────
  httpServer.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, `🟣 Gratonite API listening on port ${env.PORT}`);
  });

  // ── Graceful shutdown ──────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down gracefully');
    httpServer.close();
    await redis.quit();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});
