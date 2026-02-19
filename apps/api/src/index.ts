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

  // ── Shared context for route handlers ──────────────────────────────────
  const ctx = { db, redis, io, env };

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

  // ── Socket.IO connection handling ──────────────────────────────────────
  io.on('connection', (socket) => {
    logger.debug({ socketId: socket.id }, 'Socket connected');

    socket.on('disconnect', (reason) => {
      logger.debug({ socketId: socket.id, reason }, 'Socket disconnected');
    });
  });

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
