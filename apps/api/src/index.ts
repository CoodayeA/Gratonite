import './instrument';               // Sentry must init before everything else
import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import { logger } from './lib/logger';
import http from 'http';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { Server as SocketIOServer } from 'socket.io';

import { db, pool as dbPool } from './db/index';
import { sql } from 'drizzle-orm';
import { router } from './routes/index';
import { setIO } from './lib/socket-io';
import { initSocket } from './socket/index';
// All cron jobs migrated to BullMQ — legacy setInterval starters kept as fallback
import { httpRequestDuration, activeWebSocketConnections, registry, webhookDispatchTotal } from './lib/metrics';
import { globalIpRateLimit } from './middleware/rateLimit';
import { autoCacheHeaders } from './middleware/cache';
import { requestLogger } from './middleware/requestLogger';
import { initFederation, isFederationEnabled } from './federation/index';
import { initFederationNamespace } from './federation/realtime';
import { wellKnownHandler } from './routes/federation';
import { startBullWorkers } from './jobs/worker';
import { closeAllQueues, allQueues } from './lib/queue';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import * as Sentry from '@sentry/node';
import { handleAppError, normalizeError } from './lib/errors';

const PLACEHOLDER_PATTERNS = [
  'changeme',
  'replace-me',
  'example',
  'placeholder',
  'your-',
  'dev-',
  'test',
];

function isPlaceholderSecret(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return PLACEHOLDER_PATTERNS.some((pattern) => normalized.includes(pattern));
}

function validateCriticalEnvVars(): string[] {
  if (process.env.NODE_ENV !== 'production') return [];

  const required: Record<string, string | undefined> = {
    REDIS_URL: process.env.REDIS_URL,
    DATABASE_URL: process.env.DATABASE_URL,
    APP_URL: process.env.APP_URL || (process.env.INSTANCE_DOMAIN ? `https://${process.env.INSTANCE_DOMAIN}` : undefined),
    MFA_ENCRYPTION_KEY: process.env.MFA_ENCRYPTION_KEY,
    BULLBOARD_ADMIN_TOKEN: process.env.BULLBOARD_ADMIN_TOKEN,
  };

  // At least one auth secret must be set
  const hasAuthSecret = !!(process.env.JWT_SECRET || process.env.SESSION_SECRET);
  if (!hasAuthSecret) {
    required['JWT_SECRET or SESSION_SECRET'] = undefined;
  }

  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  return missing;
}

function validateStartupConfig(): string[] {
  const errors: string[] = [];
  const env = (process.env.NODE_ENV ?? 'development').toLowerCase();
  const isProdLike = env === 'production' || env === 'staging';
  const jwtSecret = process.env.JWT_SECRET ?? '';
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET ?? '';

  // Auto-derive APP_URL and CORS_ORIGIN from INSTANCE_DOMAIN if not explicitly set
  const instanceDomain = process.env.INSTANCE_DOMAIN;
  if (instanceDomain && !process.env.APP_URL) {
    process.env.APP_URL = `https://${instanceDomain}`;
  }
  if (instanceDomain && !process.env.CORS_ORIGIN) {
    process.env.CORS_ORIGIN = `https://${instanceDomain}`;
  }

  const appUrl = process.env.APP_URL ?? '';
  const corsOrigin = process.env.CORS_ORIGIN ?? '';

  if (jwtSecret.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters.');
  }
  if (jwtRefreshSecret.length < 32) {
    errors.push('JWT_REFRESH_SECRET must be at least 32 characters.');
  }
  if (jwtSecret === jwtRefreshSecret) {
    errors.push('JWT_SECRET and JWT_REFRESH_SECRET must be different.');
  }

  if (isProdLike) {
    if (!appUrl || !corsOrigin) {
      errors.push('APP_URL and CORS_ORIGIN are required in non-dev environments. Set them directly or set INSTANCE_DOMAIN to auto-derive.');
    }
    if (isPlaceholderSecret(jwtSecret) || isPlaceholderSecret(jwtRefreshSecret)) {
      errors.push('Placeholder JWT secrets are not allowed in non-dev environments.');
    }
  }

  if (appUrl && corsOrigin && corsOrigin !== '*') {
    try {
      const appOrigin = new URL(appUrl).origin;
      if (corsOrigin !== appOrigin) {
        errors.push(`APP_URL origin (${appOrigin}) must match CORS_ORIGIN (${corsOrigin}).`);
      }
    } catch {
      errors.push('APP_URL must be a valid absolute URL.');
    }
  }
  return errors;
}

const startupErrors: string[] = [
  ...validateCriticalEnvVars(),
  ...validateStartupConfig(),
];

if (startupErrors.length > 0) {
  const msg = `FATAL: Startup config invalid. ${startupErrors.join(' ')}`;
  logger.error(msg);
  Sentry.withScope((scope) => {
    scope.setLevel('fatal');
    scope.setFingerprint(['startup-config-invalid']);
    scope.setTag('startup_phase', 'config_validation');
    scope.setContext('startupConfigErrors', { errors: startupErrors });
    Sentry.captureMessage(msg);
  });
  process.exit(1);
}

const app = express();
const server = http.createServer(app);

// ---------------------------------------------------------------------------
// Socket.io setup
// ---------------------------------------------------------------------------

/**
 * Create the Socket.io server attached to the shared HTTP server so that both
 * REST and WebSocket traffic are served on the same port.
 *
 * CORS is configured to match the REST API's allowed origin so browser clients
 * can establish WebSocket connections from the frontend dev server or
 * production domain without being blocked by the browser's same-origin policy.
 */
if (!process.env.CORS_ORIGIN) {
  logger.warn('[cors] CORS_ORIGIN is not set, falling back to http://localhost:5173. Set CORS_ORIGIN in production.');
}

const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || ['http://localhost:5173', 'http://localhost:5174', /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/],
    credentials: true,
  },
});

/**
 * Expose the `io` instance via the shared module so route handlers can call
 * `getIO()` to emit events without circular imports.
 * This must happen before any HTTP requests can arrive (i.e. before listen()).
 */
setIO(io);

/**
 * Attach authentication middleware and connection handlers.
 * See src/socket/index.ts for the full implementation.
 */
initSocket(io);

// ---------------------------------------------------------------------------
// Express middleware
// ---------------------------------------------------------------------------

// Trust the reverse proxy (Caddy) so req.protocol reflects https
app.set('trust proxy', 1);

// Security headers (HSTS, X-Content-Type-Options, X-Frame-Options, etc.)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", "wss:", "https:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      mediaSrc: ["'self'", "blob:", "https:"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || ['http://localhost:5173', 'http://localhost:5174', /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/],
    credentials: true,
  })
);
// Global IP-based rate limit BEFORE body parsing so large payloads are rejected early
// Skip rate limiting for file/asset serving — these are CDN-like GETs that can burst heavily
app.use((req, res, next) => {
  if (req.method === 'GET' && req.path.match(/^\/api\/v1\/files\//)) {
    return next();
  }
  return globalIpRateLimit(req, res, next);
});

app.use(express.json());
app.use(cookieParser());
app.use(autoCacheHeaders);
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads'), {
  maxAge: '1d',
  immutable: true,
}));

// Structured request logging with request ID
app.use(requestLogger);

// Request duration tracking for metrics
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    httpRequestDuration.observe(
      { method: req.method, route: req.path, status: String(res.statusCode) },
      Date.now() - start,
    );
  });
  next();
});

// ---------------------------------------------------------------------------
// Health check (extended with federation status)
// ---------------------------------------------------------------------------

const SERVER_START_TIME = Date.now();

// Rolling error rate tracking
let totalRequests = 0;
let errorRequests = 0; // 5xx responses

app.use((_req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.on('finish', () => {
    totalRequests++;
    if (res.statusCode >= 500) {
      errorRequests++;
    }
  });
  next();
});

app.get('/health', async (_req, res) => {
  const health: Record<string, unknown> = {
    status: 'ok',
    ts: Date.now(),
    uptime: Math.floor((Date.now() - SERVER_START_TIME) / 1000),
    version: process.env.npm_package_version || '1.0.0',
    node: process.version,
  };

  // Check DB connectivity
  try {
    await db.execute(sql`SELECT 1 as ok`);
    health.db = { connected: true };
  } catch (err) {
    health.db = { connected: false, error: (err as Error).message };
    health.status = 'degraded';
  }

  // Check Redis connectivity
  try {
    const { redis } = await import('./lib/redis');
    await redis.ping();
    health.redis = { connected: true };
  } catch (err) {
    health.redis = { connected: false, error: (err as Error).message };
    health.status = 'degraded';
  }

  // Memory usage
  const mem = process.memoryUsage();
  health.memory = {
    rss: Math.round(mem.rss / 1024 / 1024),
    heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
  };

  // Active WebSocket connections
  health.websockets = io.engine?.clientsCount ?? 0;

  // Error rate
  health.errorRate = {
    totalRequests,
    errorRequests,
    rate: totalRequests > 0 ? +(errorRequests / totalRequests).toFixed(4) : 0,
  };

  if (isFederationEnabled()) {
    health.federation = { enabled: true };
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

// ---------------------------------------------------------------------------
// Federation well-known endpoint (public discovery, no auth)
// ---------------------------------------------------------------------------

app.get('/.well-known/gratonite', wellKnownHandler);

// ---------------------------------------------------------------------------
// Bull Board dashboard (admin-only job monitoring)
// ---------------------------------------------------------------------------

const bullBoardAdapter = new ExpressAdapter();
bullBoardAdapter.setBasePath('/admin/jobs');

// Board is created now; queues are added once workers start (queues are
// created lazily when worker.ts is imported).  We use a lazy getter so
// the board always reflects the current set of queues.
createBullBoard({
  queues: allQueues.map(q => new BullMQAdapter(q)),
  serverAdapter: bullBoardAdapter,
});

// Auth gate for Bull Board admin dashboard.
app.use('/admin/jobs', (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const expected = process.env.BULLBOARD_ADMIN_TOKEN;
  if (!expected || !token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const tokenBuf = Buffer.from(token);
    const expectedBuf = Buffer.from(expected);
    if (tokenBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(tokenBuf, expectedBuf)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}, bullBoardAdapter.getRouter() as express.Router);

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------

app.use('/api/v1', router);

// ---------------------------------------------------------------------------
// Sentry error handler (must be before custom error handler)
// ---------------------------------------------------------------------------
Sentry.setupExpressErrorHandler(app, {
  shouldHandleError(error) {
    const normalized = normalizeError(error);
    return normalized.reportable;
  },
});

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  handleAppError(res, err, 'global');
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

const PORT = Number(process.env.PORT) || 4000;

server.listen(PORT, async () => {
  logger.info(`API running on port ${PORT}`);

  // --- BullMQ workers (all cron jobs) ---
  try {
    await startBullWorkers();
  } catch (err) {
    logger.error('[bullmq] Failed to start workers, falling back to setInterval:', err);
    // Fallback: start the legacy setInterval jobs if BullMQ fails
    const { startScheduledMessagesJob } = await import('./jobs/scheduledMessages');
    const { startMessageExpiryCron } = await import('./lib/message-expiry');
    const { startEmailNotificationJob } = await import('./jobs/emailNotifications');
    const { startFederationDeliveryJob } = await import('./jobs/federationDelivery');
    const { startAccountDeletionJob } = await import('./jobs/accountDeletion');
    const { startAfkMoverJob } = await import('./jobs/afkMover');
    const { startAutoArchiveChannelsJob } = await import('./jobs/autoArchiveChannels');
    const { startAutoRolesJob } = await import('./jobs/autoRoles');
    const { startExpireStatusesJob } = await import('./jobs/expireStatuses');
    const { startFederationCleanupJob } = await import('./jobs/federationCleanup');
    const { startFederationDiscoverSyncJob } = await import('./jobs/federationDiscoverSync');
    const { startFederationHeartbeatJob } = await import('./jobs/federationHeartbeat');
    const { startFriendshipStreaksJob } = await import('./jobs/friendshipStreaks');
    const { startGiveawaysJob } = await import('./jobs/giveaways');
    const { startGuildDigestJob } = await import('./jobs/guildDigest');
    const { startRemindersJob } = await import('./jobs/reminders');
    const { startReplicaSyncJob } = await import('./jobs/replicaSync');
    const { startUnbanExpiredJob } = await import('./jobs/unbanExpired');
    const { startUpdateCheckJob } = await import('./jobs/updateCheck');
    const { startAuctionCron } = await import('./lib/auction-cron');
    startScheduledMessagesJob();
    startMessageExpiryCron();
    startEmailNotificationJob();
    startFederationDeliveryJob();
    startAccountDeletionJob();
    startAfkMoverJob();
    startAutoArchiveChannelsJob();
    startAutoRolesJob();
    startExpireStatusesJob();
    startFederationCleanupJob();
    startFederationDiscoverSyncJob();
    startFederationHeartbeatJob();
    startFriendshipStreaksJob();
    startGiveawaysJob();
    startGuildDigestJob();
    startRemindersJob();
    startReplicaSyncJob();
    startUnbanExpiredJob();
    startUpdateCheckJob();
    startAuctionCron();
    const { startCalendarSyncJob } = await import('./jobs/calendarSync');
    startCalendarSyncJob();
  }

  // Initialize federation subsystem (gated behind FEDERATION_ENABLED)
  try {
    await initFederation();
    if (isFederationEnabled()) {
      initFederationNamespace(io);
    }
  } catch (err) {
    logger.error('[federation] Failed to initialize:', (err as Error).message);
  }
});

// ---------------------------------------------------------------------------
// Graceful shutdown (Phase 9, Item 159)
// ---------------------------------------------------------------------------

let isShuttingDown = false;

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info(`[shutdown] Received ${signal}, starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(() => {
    logger.info('[shutdown] HTTP server closed (no new connections)');
  });

  // Disconnect all WebSocket clients
  try {
    io.disconnectSockets(true);
    logger.info('[shutdown] WebSocket connections closed');
  } catch (err) {
    logger.error('[shutdown] Error closing WebSocket connections:', (err as Error).message);
  }

  // Close database pool
  try {
    await dbPool.end();
    logger.info('[shutdown] Database pool closed');
  } catch (err) {
    logger.error('[shutdown] Error closing DB pool:', (err as Error).message);
  }

  // Close BullMQ queues and workers
  try {
    await closeAllQueues();
    logger.info('[shutdown] BullMQ queues and workers closed');
  } catch (err) {
    logger.error('[shutdown] Error closing BullMQ:', (err as Error).message);
  }

  // Close Redis connection
  try {
    const { redis } = await import('./lib/redis');
    await redis.quit();
    logger.info('[shutdown] Redis connection closed');
  } catch (err) {
    logger.error('[shutdown] Error closing Redis:', (err as Error).message);
  }

  logger.info('[shutdown] Graceful shutdown complete');

  // Force exit after 10s if something hangs
  setTimeout(() => {
    logger.error('[shutdown] Forced exit after timeout');
    process.exit(1);
  }, 10_000).unref();

  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export { io };
