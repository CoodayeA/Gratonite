import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { Server as SocketIOServer } from 'socket.io';

import { router } from './routes/index';
import { setIO } from './lib/socket-io';
import { initSocket } from './socket/index';
import { startAuctionCron } from './lib/auction-cron';
import { startMessageExpiryCron } from './lib/message-expiry';
import { startUnbanExpiredJob } from './jobs/unbanExpired';
import { startExpireStatusesJob } from './jobs/expireStatuses';
import { startEmailNotificationJob } from './jobs/emailNotifications';
import { startScheduledMessagesJob } from './jobs/scheduledMessages';
import { startAccountDeletionJob } from './jobs/accountDeletion';
import { startAfkMoverJob } from './jobs/afkMover';
import { startRemindersJob } from './jobs/reminders';
import { startAutoRolesJob } from './jobs/autoRoles';
import { startFriendshipStreaksJob } from './jobs/friendshipStreaks';
import { startGiveawaysJob } from './jobs/giveaways';
import { startGuildDigestJob } from './jobs/guildDigest';
import { httpRequestDuration, activeWebSocketConnections, registry } from './lib/metrics';
import { globalIpRateLimit } from './middleware/rateLimit';
import { initFederation, isFederationEnabled } from './federation/index';
import { initFederationNamespace } from './federation/realtime';
import { wellKnownHandler } from './routes/federation';
import { startFederationDeliveryJob } from './jobs/federationDelivery';
import { startFederationHeartbeatJob } from './jobs/federationHeartbeat';
import { startFederationCleanupJob } from './jobs/federationCleanup';
import { startReplicaSyncJob } from './jobs/replicaSync';
import { startUpdateCheckJob } from './jobs/updateCheck';
import { startFederationDiscoverSyncJob } from './jobs/federationDiscoverSync';

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

function validateStartupConfig(): void {
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
    throw new Error('FATAL: JWT_SECRET must be at least 32 characters.');
  }
  if (jwtRefreshSecret.length < 32) {
    throw new Error('FATAL: JWT_REFRESH_SECRET must be at least 32 characters.');
  }
  if (jwtSecret === jwtRefreshSecret) {
    throw new Error('FATAL: JWT_SECRET and JWT_REFRESH_SECRET must be different.');
  }

  if (isProdLike) {
    if (!appUrl || !corsOrigin) {
      throw new Error('FATAL: APP_URL and CORS_ORIGIN are required in non-dev environments. Set them directly or set INSTANCE_DOMAIN to auto-derive.');
    }
    if (isPlaceholderSecret(jwtSecret) || isPlaceholderSecret(jwtRefreshSecret)) {
      throw new Error('FATAL: Placeholder JWT secrets are not allowed in non-dev environments.');
    }
  }

  if (appUrl && corsOrigin) {
    const appOrigin = new URL(appUrl).origin;
    if (corsOrigin !== '*' && corsOrigin !== appOrigin) {
      throw new Error(`FATAL: APP_URL origin (${appOrigin}) must match CORS_ORIGIN (${corsOrigin}).`);
    }
  }
}

validateStartupConfig();

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
  console.warn('[cors] WARNING: CORS_ORIGIN is not set, falling back to http://localhost:5173. Set CORS_ORIGIN in production.');
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
}));

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || ['http://localhost:5173', 'http://localhost:5174', /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/],
    credentials: true,
  })
);
// Global IP-based rate limit BEFORE body parsing so large payloads are rejected early
app.use(globalIpRateLimit);

// Stripe webhook needs the raw body for signature verification — mount BEFORE express.json()
app.use('/api/v1/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

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

app.get('/health', (_req, res) => {
  const health: Record<string, unknown> = { status: 'ok', ts: Date.now() };
  if (isFederationEnabled()) {
    health.federation = { enabled: true };
  }
  res.json(health);
});

// ---------------------------------------------------------------------------
// Federation well-known endpoint (public discovery, no auth)
// ---------------------------------------------------------------------------

app.get('/.well-known/gratonite', wellKnownHandler);

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------

app.use('/api/v1', router);

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

const PORT = Number(process.env.PORT) || 4000;

server.listen(PORT, async () => {
  console.info(`API running on port ${PORT}`);

  // Start background jobs after server is listening
  startAuctionCron();
  startMessageExpiryCron();
  startUnbanExpiredJob();
  startExpireStatusesJob();
  startEmailNotificationJob();
  startScheduledMessagesJob();
  startAccountDeletionJob();
  startAfkMoverJob();
  startRemindersJob();
  startAutoRolesJob();
  startFriendshipStreaksJob();
  startGiveawaysJob();
  startGuildDigestJob();

  // Initialize federation subsystem (gated behind FEDERATION_ENABLED)
  try {
    await initFederation();
    if (isFederationEnabled()) {
      initFederationNamespace(io);
      startFederationDeliveryJob();
      startFederationHeartbeatJob();
      startFederationCleanupJob();
      startReplicaSyncJob();
      startFederationDiscoverSyncJob();
    }
  } catch (err) {
    console.error('[federation] Failed to initialize:', err);
  }

  // Update check runs regardless of federation status
  startUpdateCheckJob();
});

export { io };
