import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { Server as SocketIOServer } from 'socket.io';

import { router } from './routes/index';
import { setIO } from './lib/socket-io';
import { initSocket } from './socket/index';
import { startAuctionCron } from './lib/auction-cron';

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
      throw new Error('FATAL: APP_URL and CORS_ORIGIN are required in non-dev environments.');
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

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || ['http://localhost:5173', 'http://localhost:5174', /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: Date.now() });
});

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

server.listen(PORT, () => {
  console.info(`API running on port ${PORT}`);
  // Start background jobs after server is listening
  startAuctionCron();
});

export { io };
